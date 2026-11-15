# マルチペイン・エージェントターミナル 基本設計書

## 1. プロジェクト概要・目的

複数のAIエージェントの同時稼働（2〜3プロセス）と、手動でのPowerShellファイル操作を単一ウィンドウ（可変グリッドレイアウト）で一元管理するデスクトップアプリケーション[cite: 1]。

* **解決する課題**:
  1. 複数のPowerShellウィンドウが重なり、どのウィンドウでどのエージェント・作業が動いているか分からなくなる視認性・操作性の悪化を防ぐ[cite: 1]。
  2. 1つの課題に対して複数のAgentを動かすことを想定し、Agent同士の掲示板（共有ボード）を実装して、各Agentが何をしているのか・何を共有しているのかを可視化する[cite: 1]。
  3. マウスに手を伸ばさず、キーボードショートカットのみでペイン間のフォーカス移動や画面分割レイアウトの切り替えを完結させる。
* **配布・動作要件**: 会社のPC環境（Windows 10/11）でインストーラーや管理者権限を必要とせず、単一のポータブル実行ファイル（`.exe`）としてそのまま動作すること[cite: 1]。

## 2. 技術スタック・採用ライブラリ

Tauri公式ドキュメントおよびWezTerm（`portable-pty`）のリポジトリ仕様に基づき、最小バイナリサイズと高速なストリーム通信を実現する構成を採用する[cite: 1]。

| レイヤー | 技術 / パッケージ | 選定理由・用途 |
| :--- | :--- | :--- |
| **App Framework** | **Tauri v2** | OS標準のWebView2を利用するため数MBの単一 `.exe` を生成可能。v2の `Channel` APIによりPTYの標準出力を低遅延でストリーミングできるため最適[cite: 1]。 |
| **Backend (Rust)** | **`portable-pty`** | Windowsの擬似コンソール（`ConPTY`）を安全にラップするクレート。プロセス生成・リサイズ・終了制御の安定性が最も高い[cite: 1]。 |
| **Frontend UI** | **React 18+ / TypeScript / Vite** | 各ペインのヘッダー状態管理、掲示板パネル、UIコンポーネントの分離[cite: 1]。 |
| **Styling** | **Tailwind CSS** | CSS Gridによる可変画面分割（2×1, 2×2, 3×1, 4×1）と、`:focus-within` によるアクティブペイン枠の強調表示[cite: 1]。 |
| **Terminal描画** | **`@xterm/xterm` / `@xterm/addon-fit`** | フロントエンド側のターミナルエミュレータ描画、およびウィンドウサイズ・レイアウト変更時の自動行列計算（Fit機能）[cite: 1]。 |

## 3. システムアーキテクチャ・画面構成

### 3.1 画面レイアウト（可変Grid + Global Toolbar + Agent Board）

画面上部に全体操作用のツールバー、メイン領域にCSS Gridによるターミナル群、右サイドに開閉可能な「Agent掲示板パネル」を配置する[cite: 1]。
デフォルトは **2×1分割** とし、ショートカットキーまたはツールバーから **2×2, 3×1, 4×1** へ動的に切り替え可能とする[cite: 1]。

```text
+---------------------------------------------------------------------------------------------+
| [📁 Workspace (Alt+W)] [Apply] | Layout:[2x1][2x2][3x1][4x1] | [Hidden: 2 ●] | [📋 Board (Alt+B)] | <- GlobalToolbar
+-----------------------------------------+-----------------------------------------+-----------+
| 🟢 Agent-1  C:\work\api   [Preset▼][↻][✕] | 🔵 Agent-2  C:\work\web   [Preset▼][↻][✕] | 📋 Agent  |
| --------------------------------------- | --------------------------------------- |   Board   |
| PS C:\work\api> python agent1.py        | PS C:\work\web> python agent2.py        | --------- |
| Updating .agent-board.md...             | Reading board status...                 | [Agent-1] |
|                                         |                                         | API実装完 |
+-----------------------------------------+-----------------------------------------+           |
| ⚪ Agent-3  C:\work      [Preset▼][↻][✕] | ⚪ Manual   C:\work      [Preset▼][↻][✕] | [Agent-2] |
| --------------------------------------- | --------------------------------------- | テスト中  |
| PS C:\work>                             | PS C:\work> Get-ChildItem               |           |
|                                         | Mode  LastWriteTime  Length Name        | [Memo...] |
+-----------------------------------------+-----------------------------------------+-----------+
  * 🔵 = Focused Pane (Alt + H/J/K/L で移動、青枠ハイライト)
  * 🟢 = busy（コマンド実行中） / ⚪ = idle（プロンプト待ち） / ⚫ = 未起動 or 終了済み
  * [Hidden: 2 ●] = 現在のレイアウトで非表示だが裏で稼働中のペイン数。Alt+I で一覧を展開
```

ペインヘッダーは左から **稼働状態ドット・ペイン名・現在のcwd・プリセット・再起動・終了（✕）** の順で構成する。cwd は 3.4 のシェル統合により実際の `$pwd` を追従表示する。

### 3.2 キーボードショートカット仕様

`xterm.js` の `attachCustomKeyEventHandler` で以下のキー入力をインターセプトし、マウスレスで全操作を完結させる。

| カテゴリ | ショートカット | 動作内容 |
| :--- | :--- | :--- |
| **フォーカス移動（方向）** | `Alt + H / J / K / L`<br>または `Alt + ← / ↓ / ↑ / →` | 現在表示中のグリッド配置に基づき、上下左右の隣接ペインへフォーカス（`term.focus()`）を移動する。番号指定（`Alt + 1〜4`）による直接移動は **実装しない**。 |
| **レイアウト切替** | `Ctrl + Shift + 1` : **2×1** (左右2分割・初期値)<br>`Ctrl + Shift + 2` : **2×2** (田の字4分割)<br>`Ctrl + Shift + 3` : **3×1** (横3列分割)<br>`Ctrl + Shift + 4` : **4×1** (横4列分割) | 表示レイアウトを即座に切り替える[cite: 1]。非表示となったペインは **プロセスを終了しない**。DOMからアンマウントせず `hidden` クラスで隠し、裏でプロセスと出力バッファを維持する（詳細は 3.4）。 |
| **非表示ペイン一覧** | `Alt + I` | ツールバーの `Hidden` バッジを展開し、非表示ペインの稼働状態・直近の出力行を一覧表示する。一覧から選択すると、そのペインを含むレイアウトへ切り替えてフォーカスする。 |
| **掲示板パネル開閉** | `Alt + B` | 右サイドの `AgentBoard` パネルを開閉し、フォーカスをトグルする。 |
| **ワークスペース変更（全体）** | `Alt + W` | `GlobalToolbar` のパス入力欄にフォーカスする。`Enter` 確定でプロジェクトワークスペースを切り替え、掲示板の参照先と **idle状態の全ペイン** の cwd を変更する（3.5 参照）[cite: 1]。 |
| **ワークスペース変更（ペイン単位）** | `Alt + Shift + W` | フォーカス中ペインのヘッダーにある cwd 欄をインライン編集モードにする。`Enter` 確定でそのペインのみ `cd` する。 |
| **緊急一括停止** | `Ctrl + Shift + K` | 全4ペインへ `Ctrl+C` (`\x03`) を一斉送信する[cite: 1]。 |
| **ペインのプロセス終了** | `Ctrl + Shift + X` | フォーカス中ペインのプロセスを終了する（`kill_pty`）。busy状態のペインでは確認ダイアログを挟む。ヘッダーの `✕` ボタンと同じ動作。 |
| **エージェント入力欄での改行** | `Ctrl + Enter` | ペインが `busy`（エージェント実行中）のとき、`\x1b\r`（Alt+Enter 相当のシーケンス）を送信して入力欄に改行を挿入する。`idle` のときは通常の `Enter` として扱う（3.6 参照）。 |

### 3.3 コンポーネント設計（React）

Reactの再レンダリングによって `xterm.js` のDOMやバッファが破棄されるのを防ぐため、4つのターミナルインスタンスは常にマウントした状態で `useRef` 内に保持する[cite: 1]。

1. **`App.tsx`**
   * アプリ全体のステート管理（現在のレイアウトモード `2x1` | `2x2` | `3x1` | `4x1`、アクティブな `paneId`、掲示板の開閉状態、プロジェクトワークスペース、起動時に読み込んだ設定）[cite: 1]。
   * 各ペインの稼働状態（3.4 の `PaneStatus`）を一元管理し、`GlobalToolbar` と `TerminalPane` へ配る。
   * グローバルキーボードショートカットのリスナー登録。
2. **`GlobalToolbar.tsx`**
   * **ワークスペース変更（全体）**: 入力されたパスをプロジェクトワークスペースとして確定し、掲示板の参照先を切り替え、idle状態のペインへ `cd "<Path>"\r` を送信する。busyペインには保留マークを付け、次回再起動時に適用する（3.5 参照）[cite: 1]。
   * **レイアウト切替インジケータ**: 現在の分割モードの表示と切り替えボタン（`2x1`, `2x2`, `3x1`, `4x1`）[cite: 1]。
   * **非表示ペインインジケータ（`HiddenPanesIndicator.tsx`）**: 現レイアウトで非表示かつ起動済みのペイン数をバッジ表示し、busyなペインがあればドットを点灯する。展開すると各ペインの名前・状態・cwd・busy継続時間・直近の出力1行を一覧し、選択でそのペインを含むレイアウトへ切り替えてフォーカスする。
   * **一括停止（Emergency Stop）**: 全4ペインへ `Ctrl+C`（`\x03`）を一斉送信[cite: 1]。
   * **設定再読込**: `load_config` を再実行し、`config.json` の手編集を再起動なしで反映する。
3. **`TerminalPane.tsx`（×4インスタンス常時マウント）**
   * **アクティブ枠強調**: Tailwindの `border-2 border-neutral-800 focus-within:border-blue-500` を適用し、現在キーボード入力が向いているペインを視覚的に強調する[cite: 1]。
   * **ペインヘッダー**: 稼働状態ドット、ペイン名インライン編集、現在cwdの表示とインライン編集（`Alt+Shift+W`）、プリセット実行ドロップダウン、再起動ボタン（`kill_pty` → `spawn_pty`）、終了ボタン `✕`（`kill_pty`。busy時は確認ダイアログ）[cite: 1]。
   * **ターミナルコンテナ**: `ResizeObserver` でレイアウト切替時のDOMサイズ変更を検知し、`fitAddon.fit()` と `resize_pty` をデバウンス実行する[cite: 1]。非表示中（サイズ 0）は実行を抑止し、再表示時に1回だけ `fit()` を行う（3.4 参照）。
   * **シェル統合の受信**: `term.parser.registerOscHandler` で OSC `133` と OSC `9;9` を受け取り、`PaneStatus`（idle/busy）と cwd を `App.tsx` へ通知する（3.4 参照）。
   * **直近出力の保持**: `onData` の生バイト列はスピナーの再描画やエスケープコードを含むため使わない。xterm.js が解釈済みの `term.buffer.active` からカーソル行を起点に上方向へ走査し、最初に見つかった非空行を `translateToString(true)` で取り出して `HiddenPanesIndicator` へ渡す。更新は `onWriteParsed` を 500ms 程度でデバウンスして行う。
   * **プリセットの種別制御**: `presets[].target` が `shell` のものは `idle` 時のみ有効、`agent` のものは `busy` 時のみ有効とし、状態が合わない項目はドロップダウンで無効化する（6.2 参照）。
4. **`AgentBoard.tsx`（Agent同士の掲示板パネル）**
   * プロジェクトワークスペース直下の共有ファイル（`.agent-board.md`）の内容をリアルタイム表示・編集するパネル[cite: 1]。`config.json` の `boardPath` が指定されていればそのパスを優先する。
   * 各Agentが書き込んだ進捗状況・タスク分担・エラー報告を一覧化し、人間側からも追記や全ペインへのブロードキャスト通知を行える[cite: 1]。
   * ペインごとに cwd が異なっていても、掲示板はプロジェクトワークスペース配下の1ファイルに固定する。

### 3.4 ペインのライフサイクルと稼働状態の可視化

レイアウト切替によってペインが非表示になっても **プロセスは終了しない**。プロセスの終了は利用者の明示的な操作（ヘッダー `✕` / `Ctrl+Shift+X` / 再起動）に限定し、非表示中のペインが何をしているかは常に追跡できるようにする。

#### 3.4.1 ペインの状態モデル

```ts
type PaneStatus =
  | "not_started" // まだ spawn_pty されていない（遅延spawn）
  | "idle"        // プロンプト待ち。OSC 133;A 受信後、次の Enter 送信まで
  | "busy"        // コマンド実行中。Enter 送信後、次の OSC 133;A 受信まで
  | "exited";     // プロセスが終了（reader の EOF 検知、または kill_pty 実行）

interface PaneRuntime {
  status: PaneStatus;
  cwd: string | null;          // OSC 9;9 で受信した実際の $pwd
  busySince: number | null;    // busy 遷移時刻。継続時間表示用
  lastOutputLine: string;      // xterm バッファから取得した直近の非空行（先頭 80 文字程度に切り詰め）
  pendingCwd: string | null;   // 全体ワークスペース変更を busy 中に受けた場合の保留値
}
```

#### 3.4.2 ライフサイクル

| イベント | 動作 |
| :--- | :--- |
| **アプリ起動** | `load_config` 実行後、`defaultLayout` で **表示されるペインのみ** `spawn_pty` する。非表示ペインは `not_started` のままにして、見えない場所で `autoStartCmd` が走ることを防ぐ（遅延spawn）。 |
| **レイアウト切替で表示される** | `not_started` なら `spawn_pty` を実行し、`autoStartCmd` があれば送信する。起動済みなら `fit()` と `resize_pty` を1回実行して再表示する。 |
| **レイアウト切替で非表示になる** | `hidden` クラスで隠すだけ。プロセス・xterm バッファ・`PaneRuntime` はすべて維持する。 |
| **再起動（↻）** | `kill_pty` → `spawn_pty`。`pendingCwd` があればそれを `cwd` に使い、保留を解消する。 |
| **終了（✕ / Ctrl+Shift+X）** | `status === "busy"` なら確認ダイアログを表示してから `kill_pty`。終了後は `exited` とし、ヘッダーに「再起動で復帰」を表示する。 |
| **プロセスが自然終了** | Rust 側 reader スレッドの EOF 検知で `on_data` の終了通知を受け、`exited` に遷移する。非表示ペインの場合は `HiddenPanesIndicator` のバッジ色で知らせる。 |
| **アプリ終了** | 全セッションに `kill_pty` を実行する。 |

#### 3.4.3 シェル統合（状態・cwd の正確な取得）

状態や cwd を出力文字列から推測せず、PowerShell の `prompt` 関数が出力するエスケープシーケンスで取得する。起動引数（4.2）で以下を定義する。

```powershell
function prompt {
  $e = [char]27
  # OSC 133;A = プロンプト表示開始（= idle）, OSC 9;9 = 現在の cwd 通知
  "$e]133;A$e\$e]9;9;$($pwd.Path)$e\PS $($pwd.Path)> "
}
```

* フロント側は `xterm.js` の `registerOscHandler(133, ...)` と `registerOscHandler(9, ...)` で受信する。
* `busy` への遷移は `xterm.onData` で `\r` を送信した時点とする。コマンド開始マーク（OSC 133;C）は PowerShell 標準では取得が難しいため採用しない。
* エージェントが `prompt` 関数を持たない対話型プロセス（Python REPL 等）を起動している間は OSC が来ないので、そのペインは `busy` のままになる。これは「エージェント実行中」の表示として期待どおりの挙動とする。

#### 3.4.4 非表示ペインに対するリサイズ抑止

`display: none` の要素に対して `ResizeObserver` はサイズ 0 を通知する。この状態で `fitAddon.fit()` を呼ぶと 0 行 0 列が算出され、`resize_pty` が失敗または表示崩れを起こす。以下を必須とする。

* `ResizeObserver` のコールバックで `width === 0 || height === 0` のときは何もしない。
* ペインが表示状態に戻ったとき（`hidden` クラス除去後）に、`requestAnimationFrame` で1回 `fit()` と `resize_pty` を実行する。
* `resize_pty` は Rust 側でも `rows == 0 || cols == 0` を拒否してエラーを返す。

### 3.5 ワークスペースの二層構造

「プロジェクトワークスペース」と「ペインの cwd」を別概念として扱う。

| 概念 | 役割 | 変更手段 |
| :--- | :--- | :--- |
| **プロジェクトワークスペース** | 掲示板 `.agent-board.md` の置き場所。各ペインの cwd の初期値。 | `Alt+W`、`config.json` の `defaultWorkspace` |
| **ペインの cwd** | 各 PowerShell プロセスの実際のカレントディレクトリ。ペインごとに異なってよい。 | `Alt+Shift+W`、ペイン内での手動 `cd`、`config.json` の `panes[].cwd` |

#### 全体ワークスペース変更（`Alt+W`）の適用規則

`cd "<Path>"\r` を `write_pty` で送る方式は、エージェントが実行中のペインでは **エージェントの標準入力に文字列を打ち込むことになる**。これを避けるため、状態に応じて適用方法を切り替える。

| ペイン状態 | 動作 |
| :--- | :--- |
| `idle` | 即時に `cd "<Path>"\r` を送信する。 |
| `busy` | 送信しない。`pendingCwd` に保存し、ヘッダーに保留マークを表示する。次回の再起動時に `spawn_pty` の `cwd` として適用する。 |
| `not_started` | `pendingCwd` に保存し、初回 `spawn_pty` の `cwd` として適用する。 |
| `exited` | `pendingCwd` に保存し、再起動時に適用する。 |

掲示板の参照先はペイン状態に関係なく即時に切り替える。

### 3.6 エージェント TUI（Claude Code 等）との互換性

Claude Code のような対話型 CLI は、スラッシュコマンドの補完メニューやスピナーを含む UI 全体を ANSI エスケープシーケンスで標準出力に描画する。本アプリは ConPTY + xterm.js の組み合わせで完全なターミナルエミュレータとして振る舞うため、**エージェント専用の UI を実装する必要はない**。Windows Terminal で `claude` を起動した場合と同じ描画・操作がそのまま成立する。設計上の注意点は以下のとおり。

| 項目 | 方針 |
| :--- | :--- |
| **ショートカットの横取り** | `attachCustomKeyEventHandler` で本アプリが消費したキーはエージェントに届かない。3.2 のキー割り当ては、Claude Code が使用するキー（`Alt+T`、`Ctrl+O`、`Shift+Tab` 等）と競合しないことを実装前に確認する。 |
| **入力欄での改行（Ctrl+Enter）** | xterm.js の既定では `Enter`、`Shift+Enter`、`Ctrl+Enter` のいずれも `\r` を送る。本アプリでは `Ctrl+Enter` を改行キーとし、`attachCustomKeyEventHandler` で捕捉して `\x1b\r` を `write_pty` する。これは Claude Code の `/terminal-setup` が Shift+Enter に割り当てるものと同じシーケンスで、Claude Code 側の追加設定は不要。`Alt+Enter` は xterm.js が既定で `\x1b\r` を送るためそのまま使える。変換はペインが `busy` のときだけ行い、`idle`（PowerShell プロンプト）では PSReadLine が `Esc` を行クリアと解釈するのを避けるため通常の `\r` を送る。Shift+Enter は対応しない。 |
| **ペインの最小幅** | 動的再描画型 TUI は端末幅が狭いと折り返しが崩れる。4×1 レイアウトはエージェント用途を想定せず、エージェントを置くペインは 80 列以上を目安とする。 |
| **ConPTY のリサイズ時の乱れ** | ConPTY はリサイズ時に内部バッファを再描画するため、TUI の行が重複表示されることがある。完全には防げないため、`resize_pty` のデバウンスを 150ms 以上にし、非表示中はリサイズを送らない（3.4.4）。 |
| **色対応の判定** | エージェントは環境変数で端末の色対応を判定する。`spawn_pty` で `TERM` と `COLORTERM` を設定する（4.2）。 |
| **エージェントへの文字列送信** | エージェント実行中のペインに `write_pty` した文字列は、エージェントの入力欄に打ち込まれる。これを利用してプリセットから指示文を送れる（6.2 の `target: "agent"`）。 |

## 4. バックエンド設計（Rust / Tauri）

### 4.1 セッション状態管理（`AppState`）

ペインID（`0`〜`3` の `u8`）をキーとして、4つの独立したPowerShellプロセスをスレッドセーフに管理する[cite: 1]。

```rust
use portable_pty::{Child, MasterPty};
use std::collections::HashMap;
use std::io::Write;
use std::sync::Mutex;

pub struct PtySession {
    pub writer: Box<dyn Write + Send>,     // キー入力・コマンド書き込み用
    pub master: Box<dyn MasterPty + Send>, // ウィンドウリサイズ通知用
    pub child: Box<dyn Child + Send>,      // プロセス死活監視・強制終了(Kill)用
}

pub struct AppState {
    pub sessions: Mutex<HashMap<u8, PtySession>>,
}
```

### 4.2 PowerShell起動仕様（UTF-8文字化け対策）

Windows環境のデフォルト（CP932 / Shift-JIS）によるAIエージェントの日本語・絵文字出力崩れを防ぐため、起動時にUTF-8エンコーディングを強制する[cite: 1]。あわせて 3.4.3 のシェル統合用 `prompt` 関数を定義する。

* **実行ファイル**: `powershell.exe`[cite: 1]
* **カレントディレクトリ**: `spawn_pty` の `cwd` 引数（ペインの `pendingCwd` → `config.json` の `panes[].cwd` → `defaultWorkspace` の優先順で決定）
* **起動引数**:
```rust
const INIT_SCRIPT: &str = concat!(
    // 出力・入力・パイプの3箇所を UTF-8 に揃える
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ",
    "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; ",
    "$OutputEncoding = [System.Text.Encoding]::UTF8; ",
    // シェル統合: OSC 133;A (idle) と OSC 9;9 (cwd) を prompt から出力
    "function prompt { $e=[char]27; ",
    "\"$e]133;A$e\\$e]9;9;$($pwd.Path)$e\\PS $($pwd.Path)> \" }",
);

cmd.args(["-NoLogo", "-NoExit", "-Command", INIT_SCRIPT]);

// エージェント TUI の色対応判定用（3.6）
cmd.env("TERM", "xterm-256color");
cmd.env("COLORTERM", "truecolor");
```

* `[Console]::OutputEncoding` だけでは外部プログラムへパイプした文字列が CP932 になるため、`$OutputEncoding` も設定する。`[Console]::InputEncoding` は日本語入力の文字化け防止用。
* `TERM` / `COLORTERM` は、Claude Code 等の Node.js 製 CLI が 256 色・トゥルーカラーを有効にするかの判定に使う。未設定だと配色が落ちることがある。

## 5. IPC通信インターフェース仕様

フロントエンドとRustバックエンド間の通信は、PTY制御用の4コマンド、エージェント掲示板（共有ファイル）読み書き用の2コマンド、設定ファイル読み書き用の2コマンドで完結させる[cite: 1]。

| コマンド名 | 引数 | 戻り値 | 処理内容 |
| :--- | :--- | :--- | :--- |
| **`spawn_pty`** | `pane_id: u8`, `rows: u16`, `cols: u16`, `cwd: Option<String>`, `on_data: Channel<PtyEvent>` | `Result<(), String>` | 指定サイズのConPTYを生成し、`powershell.exe` を起動。別スレッドで `reader` を回し、標準出力を `PtyEvent::Data(Vec<u8>)` でフロントへ常時ストリーミングする。`reader` が EOF に達したら `PtyEvent::Exit` を送信してセッションを削除する（3.4.2 の自然終了検知）[cite: 1]。 |
| **`write_pty`** | `pane_id: u8`, `data: String` | `Result<(), String>` | `xterm.onData` のキー入力、またはUIボタンからのコマンド文字列を対象ペインの `writer` に書き込み、`flush()` する[cite: 1]。 |
| **`resize_pty`** | `pane_id: u8`, `rows: u16`, `cols: u16` | `Result<(), String>` | レイアウト変更時等に `fitAddon` が算出した新しい行数・列数を受け取り、`master.resize()` を実行して表示崩れを防ぐ[cite: 1]。`rows == 0 || cols == 0` はエラーとして拒否する（3.4.4）。 |
| **`kill_pty`** | `pane_id: u8` | `Result<(), String>` | 対象ペインの `child.kill()` を実行してプロセスを強制終了し、`sessions` マップから削除する[cite: 1]。 |
| **`read_board`** | `board_path: String` | `Result<String, String>` | 指定パスの `.agent-board.md` を読み取って返す（存在しない場合は初期テンプレートを生成）。パスはフロント側で `boardPath` または `<defaultWorkspace>/.agent-board.md` に解決する。 |
| **`write_board`** | `board_path: String`, `content: String` | `Result<(), String>` | UI側から編集された掲示板の内容を `.agent-board.md` に保存する。 |
| **`load_config`** | なし | `Result<AppConfig, ConfigError>` | 実行ファイルと同階層の `config.json` を読み込んで返す。ファイルが無ければ既定値で生成してから返す。パース失敗時はエラー内容と既定値を返し、既存ファイルは **上書きしない**（6章）。 |
| **`save_config`** | `config: AppConfig` | `Result<(), String>` | UI の「設定を保存」操作で `config.json` へ書き戻す。一時ファイルに書いてからリネームし、書き込み途中の破損を防ぐ。 |

```rust
#[derive(Clone, serde::Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum PtyEvent {
    Data(Vec<u8>),
    Exit,
}
```

## 6. プリセット・設定データ仕様

会社PCでコードをビルドし直さずに起動コマンドや初期パスを変更できるよう、設定は **実行ファイルと同階層の `config.json`** で管理する[cite: 1]。`localStorage` は WebView2 のプロファイル（`%LOCALAPPDATA%` 配下）に保存されるが、個人的に設定ファイルがexeと同梱されていた方が分かりやすいので採用しない。

### 6.1 配置と読み書きの規則

| 項目 | 規則 |
| :--- | :--- |
| **パス解決** | Rust 側で `std::env::current_exe()` の親ディレクトリ + `config.json`。Tauri の `resource_dir()` は別の場所を指すため使わない。 |
| **初回起動** | ファイルが無ければ既定値（下記 JSON）を書き出す。利用者はこのファイルを見ながら編集できる。 |
| **文字コード** | UTF-8。Windows のメモ帳が付ける先頭 BOM（`EF BB BF`）は `serde_json` がエラーにするため、パース前に除去する。 |
| **パース失敗時** | 既定値で起動し、ツールバーにエラーバナー（行・列・原因）を表示する。壊れたファイルは **上書きしない**。利用者の編集内容を黙って消さないため。 |
| **正本の所在** | `config.json` は利用者が手で編集する正本。アプリが書き戻すのは「設定を保存」操作時のみ。ペイン名のインライン編集や現在のレイアウトは **セッション内の一時状態** とし、自動では書き戻さない。 |
| **再読込** | ツールバーの「設定再読込」で `load_config` を再実行する。`presets` と `panes[].title` は即時反映、`panes[].cwd` と `autoStartCmd` は次回 spawn 時に反映。 |
| **書き込み** | 一時ファイルへ書いてからリネームする。実行ファイルの場所が読み取り専用の場合は保存失敗をエラーバナーで通知し、起動自体は続行する。 |

### 6.2 スキーマ

```json
{
  "defaultWorkspace": "C:\\work",
  "defaultLayout": "2x1",
  "boardPath": null,
  "panes": [
    { "id": 0, "title": "Agent 1 (Main)",   "cwd": "C:\\work\\api", "autoStartCmd": "" },
    { "id": 1, "title": "Agent 2 (Sub)",    "cwd": "C:\\work\\web", "autoStartCmd": "" },
    { "id": 2, "title": "Agent 3 (Review)", "cwd": null,            "autoStartCmd": "" },
    { "id": 3, "title": "Manual PowerShell","cwd": null,            "autoStartCmd": "" }
  ],
  "presets": [
    {
      "label": "Start Claude Code",
      "target": "shell",
      "command": "claude"
    },
    {
      "label": "Activate venv & Start Agent",
      "target": "shell",
      "command": ".\\.venv\\Scripts\\Activate.ps1; python main_agent.py"
    },
    {
      "label": "Prompt Agent to Read Board",
      "target": "agent",
      "command": "Read .agent-board.md and update your task status."
    },
    {
      "label": "Git Status & Diff",
      "target": "shell",
      "command": "git status -s; git diff --stat"
    },
    {
      "label": "Clear Screen",
      "target": "shell",
      "command": "cls"
    }
  ]
}
```

#### プリセットの2種別

| `target` | 送信先 | 有効条件 | 送信内容 |
| :--- | :--- | :--- | :--- |
| `shell` | PowerShell のプロンプト | ペインが `idle` | `command + "\r"`。busy中に送るとエージェントの入力欄に打ち込まれてしまうため、`busy` 時はドロップダウンで無効化する。 |
| `agent` | 実行中のエージェントの入力欄 | ペインが `busy` | `command + "\r"`。idle中に送ると PowerShell がコマンドとして実行してエラーになるため、`idle` 時は無効化する。 |

送信するバイト列は同じで、違いは **有効条件のガード** だけである。`\r` は送信時に自動付与するため、`command` には含めない。

| フィールド | 型 | 説明 |
| :--- | :--- | :--- |
| `defaultWorkspace` | `string` | プロジェクトワークスペース。掲示板の既定の置き場所と、`cwd` 未指定ペインの初期ディレクトリ。 |
| `defaultLayout` | `"2x1" \| "2x2" \| "3x1" \| "4x1"` | 起動時のレイアウト。ここで表示されるペインだけが起動時に spawn される（遅延spawn）。 |
| `boardPath` | `string \| null` | 掲示板ファイルのフルパス。`null` なら `<defaultWorkspace>\.agent-board.md`。 |
| `panes[].id` | `0 \| 1 \| 2 \| 3` | ペインID。グリッド上の位置と対応する。 |
| `panes[].title` | `string` | ヘッダーに表示するペイン名。 |
| `panes[].cwd` | `string \| null` | このペイン固有の初期ディレクトリ。`null` なら `defaultWorkspace`。 |
| `panes[].autoStartCmd` | `string` | 初回 spawn 直後に送信するコマンド。末尾の `\r` は自動で付与する。空文字なら送信しない。 |
| `presets[].label` | `string` | プリセットドロップダウンの表示名。 |
| `presets[].target` | `"shell" \| "agent"` | 送信先。`shell` は PowerShell プロンプト向けで idle 時のみ有効、`agent` は実行中エージェントの入力欄向けで busy 時のみ有効。 |
| `presets[].command` | `string` | 送信する文字列。末尾の `\r` は自動付与するため含めない。 |

バリデーションは Rust 側で `serde` のデシリアライズ時に行い、`panes` の `id` 重複や未知の `defaultLayout` 値は `ConfigError` として返す。

## 7. ディレクトリ構成

```text
multi-agent-term/
├── package.json
├── index.html
├── config.json                     # ビルド成果物の .exe と同階層に配置する既定設定（6章）
├── src/                            # Frontend (React + TypeScript)
│   ├── main.tsx
│   ├── App.tsx                     # 可変Gridレイアウト・ショートカット制御・全体ステート
│   ├── types.ts                    # 設定・レイアウト・プリセット・PaneStatus の型定義
│   ├── shellIntegration.ts         # OSC 133 / OSC 9;9 の受信と PaneRuntime 更新（3.4.3）
│   ├── workspace.ts                # 全体/ペイン単位の cwd 適用規則（3.5）
│   └── components/
│       ├── GlobalToolbar.tsx       # ワークスペース変更・レイアウト切替・一括Ctrl+C・設定再読込
│       ├── HiddenPanesIndicator.tsx# 非表示ペインの稼働状態バッジと一覧（3.4）
│       ├── TerminalPane.tsx        # ヘッダー + xterm.js インスタンス管理
│       └── AgentBoard.tsx          # エージェント間共有掲示板パネル (.agent-board.md)
└── src-tauri/                      # Backend (Rust)
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/
        ├── main.rs                 # エントリポイント
        ├── lib.rs                  # State初期化・Command登録
        ├── pty.rs                  # portable-pty ラッパーと4つのPTYコマンド実装・PtyEvent
        ├── board.rs                # .agent-board.md の読み書き実装
        └── config.rs               # config.json の読み込み・BOM除去・検証・保存（6章）
```