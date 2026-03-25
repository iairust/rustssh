use std::sync::Arc;
use tauri::Manager;

mod connection;
mod terminal;
mod sftp;
mod models;
mod command_history;
mod import;

use terminal::SharedTerminalSessions;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 初始化终端会话管理器
            let terminal_sessions: SharedTerminalSessions = Arc::new(terminal::TerminalSessions::new());
            app.manage(terminal_sessions);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_path,
            // 连接管理
            connection::get_all_connections,
            connection::get_connection,
            connection::create_connection,
            connection::update_connection,
            connection::delete_connection,
            connection::test_connection,
            // 终端
            terminal::connect_terminal,
            terminal::send_data,
            terminal::resize_terminal,
            terminal::disconnect_terminal,
            // SFTP
            sftp::list_directory,
            sftp::download_file,
            sftp::upload_file,
            sftp::delete_path,
            sftp::create_directory,
            // 命令历史
            command_history::save_command,
            command_history::get_command_history,
            command_history::get_frequent_commands,
            command_history::clear_command_history,
            command_history::export_command_history,
            // 导入 Xshell 会话
            import::parse_import_file,
            import::batch_import_connections,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn get_app_path(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}
