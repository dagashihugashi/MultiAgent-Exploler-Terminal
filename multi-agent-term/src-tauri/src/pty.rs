//! ConPTY session management via `portable-pty` (Design-doc 4.1, 4.2, 5.).

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

const SHELL: &str = "powershell.exe";
const READ_BUF_SIZE: usize = 8 * 1024;

/// Forces UTF-8 on all three encoding knobs and installs the shell-integration
/// prompt that emits OSC 133;A (idle) and OSC 9;9 (cwd). See Design-doc 3.4.3.
const INIT_SCRIPT: &str = concat!(
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ",
    "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; ",
    "$OutputEncoding = [System.Text.Encoding]::UTF8; ",
    "function prompt { $e=[char]27; ",
    "\"$e]133;A$e\\$e]9;9;$($pwd.Path)$e\\PS $($pwd.Path)> \" }",
);

#[derive(Clone, Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum PtyEvent {
    /// Decoded UTF-8 output. Bytes are decoded on the Rust side with a carry
    /// buffer so multibyte characters split across reads are never corrupted.
    Data(String),
    Exit,
}

pub struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

#[derive(Default)]
pub struct AppState {
    pub sessions: Mutex<HashMap<u8, PtySession>>,
}

type Sessions<'a> = std::sync::MutexGuard<'a, HashMap<u8, PtySession>>;

fn lock_sessions(state: &AppState) -> Result<Sessions<'_>, String> {
    state
        .sessions
        .lock()
        .map_err(|_| "session map lock poisoned".to_string())
}

fn pty_size(rows: u16, cols: u16) -> Result<PtySize, String> {
    if rows == 0 || cols == 0 {
        return Err(format!(
            "invalid pty size {rows}x{cols}: rows and cols must be > 0"
        ));
    }
    Ok(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })
}

fn build_shell_command(cwd: Option<String>) -> CommandBuilder {
    let mut cmd = CommandBuilder::new(SHELL);
    cmd.args(["-NoLogo", "-NoExit", "-Command", INIT_SCRIPT]);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    if let Some(dir) = cwd.filter(|d| !d.trim().is_empty()) {
        cmd.cwd(dir);
    }
    cmd
}

/// Splits off the longest valid UTF-8 prefix of `pending`, leaving any
/// trailing incomplete sequence in place for the next read.
fn take_complete_utf8(pending: &mut Vec<u8>) -> String {
    match std::str::from_utf8(pending) {
        Ok(text) => {
            let text = text.to_owned();
            pending.clear();
            text
        }
        Err(err) if err.error_len().is_some() => {
            // Genuinely invalid bytes: decode lossily rather than stall.
            let text = String::from_utf8_lossy(pending).into_owned();
            pending.clear();
            text
        }
        Err(err) => {
            let valid = err.valid_up_to();
            let rest = pending.split_off(valid);
            let text = String::from_utf8_lossy(pending).into_owned();
            *pending = rest;
            text
        }
    }
}

fn stream_output(mut reader: Box<dyn Read + Send>, channel: Channel<PtyEvent>) {
    let mut buf = vec![0u8; READ_BUF_SIZE];
    let mut pending: Vec<u8> = Vec::new();
    loop {
        let n = match reader.read(&mut buf) {
            Ok(0) | Err(_) => break,
            Ok(n) => n,
        };
        pending.extend_from_slice(&buf[..n]);
        let text = take_complete_utf8(&mut pending);
        if !text.is_empty() && channel.send(PtyEvent::Data(text)).is_err() {
            break;
        }
    }
    if !pending.is_empty() {
        let _ = channel.send(PtyEvent::Data(
            String::from_utf8_lossy(&pending).into_owned(),
        ));
    }
}

fn remove_session(app: &AppHandle, pane_id: u8) {
    let state = app.state::<AppState>();
    // Dropping the session closes the pseudoconsole, which unblocks the reader.
    let removed = state
        .sessions
        .lock()
        .ok()
        .and_then(|mut sessions| sessions.remove(&pane_id));
    drop(removed);
}

#[tauri::command]
pub fn spawn_pty(
    app: AppHandle,
    state: State<'_, AppState>,
    pane_id: u8,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
    on_data: Channel<PtyEvent>,
) -> Result<(), String> {
    let size = pty_size(rows, cols)?;
    if lock_sessions(&state)?.contains_key(&pane_id) {
        return Err(format!("pane {pane_id} already has a running session"));
    }

    let pair = native_pty_system()
        .openpty(size)
        .map_err(|e| format!("openpty failed: {e}"))?;
    let mut child = pair
        .slave
        .spawn_command(build_shell_command(cwd))
        .map_err(|e| format!("failed to spawn {SHELL}: {e}"))?;
    drop(pair.slave);

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("failed to clone pty reader: {e}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("failed to take pty writer: {e}"))?;
    let killer = child.clone_killer();

    lock_sessions(&state)?.insert(
        pane_id,
        PtySession {
            writer,
            master: pair.master,
            killer,
        },
    );

    let data_channel = on_data.clone();
    thread::spawn(move || stream_output(reader, data_channel));
    thread::spawn(move || {
        let _ = child.wait();
        remove_session(&app, pane_id);
        let _ = on_data.send(PtyEvent::Exit);
    });
    Ok(())
}

#[tauri::command]
pub fn write_pty(state: State<'_, AppState>, pane_id: u8, data: String) -> Result<(), String> {
    let mut sessions = lock_sessions(&state)?;
    let session = sessions
        .get_mut(&pane_id)
        .ok_or_else(|| format!("pane {pane_id} has no session"))?;
    session
        .writer
        .write_all(data.as_bytes())
        .and_then(|_| session.writer.flush())
        .map_err(|e| format!("write to pane {pane_id} failed: {e}"))
}

#[tauri::command]
pub fn resize_pty(
    state: State<'_, AppState>,
    pane_id: u8,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let size = pty_size(rows, cols)?;
    let sessions = lock_sessions(&state)?;
    let session = sessions
        .get(&pane_id)
        .ok_or_else(|| format!("pane {pane_id} has no session"))?;
    session
        .master
        .resize(size)
        .map_err(|e| format!("resize of pane {pane_id} failed: {e}"))
}

#[tauri::command]
pub fn kill_pty(state: State<'_, AppState>, pane_id: u8) -> Result<(), String> {
    let mut session = lock_sessions(&state)?
        .remove(&pane_id)
        .ok_or_else(|| format!("pane {pane_id} has no session"))?;
    session
        .killer
        .kill()
        .map_err(|e| format!("kill of pane {pane_id} failed: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn take_complete_utf8_returns_whole_buffer_when_valid() {
        let mut pending = "日本語 ok".as_bytes().to_vec();
        assert_eq!(take_complete_utf8(&mut pending), "日本語 ok");
        assert!(pending.is_empty());
    }

    #[test]
    fn take_complete_utf8_keeps_incomplete_tail_for_next_read() {
        // U+65E5 is E6 97 A5; feed only the first two bytes after a complete char.
        let mut pending = vec![b'a', 0xE6, 0x97];
        assert_eq!(take_complete_utf8(&mut pending), "a");
        assert_eq!(pending, vec![0xE6, 0x97]);

        pending.push(0xA5);
        assert_eq!(take_complete_utf8(&mut pending), "日");
        assert!(pending.is_empty());
    }

    #[test]
    fn take_complete_utf8_decodes_invalid_bytes_lossily() {
        let mut pending = vec![b'a', 0xFF, b'b'];
        assert_eq!(take_complete_utf8(&mut pending), "a\u{FFFD}b");
        assert!(pending.is_empty());
    }

    #[test]
    fn pty_size_rejects_zero_dimensions() {
        assert!(pty_size(0, 80).is_err());
        assert!(pty_size(24, 0).is_err());
        assert!(pty_size(24, 80).is_ok());
    }

    #[test]
    fn build_shell_command_accepts_blank_or_missing_cwd() {
        let _ = build_shell_command(Some("   ".to_string()));
        let _ = build_shell_command(None);
        let _ = build_shell_command(Some("C:\\".to_string()));
    }
}
