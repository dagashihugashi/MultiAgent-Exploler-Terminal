mod pty;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(pty::AppState::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                pty::kill_all_sessions(&window.state::<pty::AppState>());
            }
        })
        .invoke_handler(tauri::generate_handler![
            pty::spawn_pty,
            pty::write_pty,
            pty::resize_pty,
            pty::kill_pty,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
