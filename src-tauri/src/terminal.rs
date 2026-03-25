use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write as IoWrite};
use std::sync::Arc;
use std::net::TcpStream;
use std::thread;
use std::sync::mpsc as std_mpsc;
use tauri::{Emitter, State};
use tokio::sync::Mutex;

use base64::{Engine as _, engine::general_purpose};

pub struct TerminalSessions {
    sessions: Mutex<HashMap<String, std_mpsc::Sender<String>>>,
}

impl TerminalSessions {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for TerminalSessions {
    fn default() -> Self {
        Self::new()
    }
}

pub type SharedTerminalSessions = Arc<TerminalSessions>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub auth_type: String,
}

// 启动后台 SSH 线程
fn spawn_ssh_thread(
    conn: ConnectionInfo,
    cols: u16,
    rows: u16,
    term_id: String,
    app: tauri::AppHandle,
) -> Result<std_mpsc::Sender<String>, String> {
    let (tx, rx) = std_mpsc::channel::<String>();

    thread::spawn(move || {
        // 建立 SSH 连接
        let addr = format!("{}:{}", conn.host, conn.port);
        let tcp = match TcpStream::connect(&addr) {
            Ok(t) => {
                t.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();
                t
            }
            Err(e) => {
                let _ = app.emit("terminal-event", serde_json::json!({
                    "termId": term_id,
                    "type": "error",
                    "message": format!("连接失败: {}", e)
                }));
                return;
            }
        };
        
        let mut session = match ssh2::Session::new() {
            Ok(s) => s,
            Err(e) => {
                let _ = app.emit("terminal-event", serde_json::json!({
                    "termId": term_id,
                    "type": "error",
                    "message": format!("创建 SSH 会话失败: {}", e)
                }));
                return;
            }
        };
        
        session.set_tcp_stream(tcp);
        
        if let Err(e) = session.handshake() {
            let _ = app.emit("terminal-event", serde_json::json!({
                "termId": term_id,
                "type": "error",
                "message": format!("SSH 握手失败: {}", e)
            }));
            return;
        }
        
        // 认证
        let auth_result = match conn.auth_type.as_str() {
            "key" => {
                // 密钥认证需要临时文件
                let key = conn.private_key.as_deref().unwrap_or("");
                if key.is_empty() {
                    let _ = app.emit("terminal-event", serde_json::json!({
                        "termId": term_id,
                        "type": "error",
                        "message": "私钥内容为空".to_string()
                    }));
                    return;
                }
                
                // 写入临时文件
                let temp_dir = std::env::temp_dir();
                let key_path = temp_dir.join(format!("ssh_key_{}", uuid::Uuid::new_v4()));
                if let Err(e) = std::fs::write(&key_path, key) {
                    let _ = app.emit("terminal-event", serde_json::json!({
                        "termId": term_id,
                        "type": "error",
                        "message": format!("写入临时密钥文件失败: {}", e)
                    }));
                    return;
                }
                
                let result = session.userauth_pubkey_file(
                    &conn.username,
                    None,
                    &key_path,
                    None,
                );
                
                // 清理临时文件
                let _ = std::fs::remove_file(key_path);
                result
            }
            _ => {
                let pw = conn.password.as_deref().unwrap_or("");
                session.userauth_password(&conn.username, pw)
            }
        };
        
        if let Err(e) = auth_result {
            let _ = app.emit("terminal-event", serde_json::json!({
                "termId": term_id,
                "type": "error",
                "message": format!("认证失败: {}", e)
            }));
            return;
        }
        
        if !session.authenticated() {
            let _ = app.emit("terminal-event", serde_json::json!({
                "termId": term_id,
                "type": "error",
                "message": "认证失败 - 未认证"
            }));
            return;
        }
        
        // 打开会话 channel
        let mut channel = match session.channel_session() {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("terminal-event", serde_json::json!({
                    "termId": term_id,
                    "type": "error",
                    "message": format!("打开通道失败: {}", e)
                }));
                return;
            }
        };
        
        // 请求 PTY
        if let Err(e) = channel.request_pty("xterm-256color", None, None) {
            println!("PTY 请求失败 (非致命): {}", e);
        }
        
        // 启动交互式 shell
        if let Err(e) = channel.shell() {
            let _ = app.emit("terminal-event", serde_json::json!({
                "termId": term_id,
                "type": "error",
                "message": format!("启动 shell 失败: {}", e)
            }));
            return;
        }
        
        // 发送连接成功
        let _ = app.emit("terminal-event", serde_json::json!({
            "termId": term_id,
            "type": "status",
            "status": "connected"
        }));
        
        // 设置非阻塞模式
        session.set_blocking(false);
        
        let mut buf = [0u8; 8192];
        let mut consecutive_errors = 0;
        
        loop {
            // 读取 SSH 输出
            match channel.read(&mut buf) {
                Ok(0) => {
                    // EOF - 连接关闭
                    println!("SSH EOF received");
                    break;
                }
                Ok(n) => {
                    consecutive_errors = 0;
                    let data = general_purpose::STANDARD.encode(&buf[..n]);
                    let _ = app.emit("terminal-event", serde_json::json!({
                        "termId": term_id,
                        "type": "data",
                        "data": data
                    }));
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // 无数据，正常情况
                    consecutive_errors = 0;
                }
                Err(e) => {
                    consecutive_errors += 1;
                    println!("读取错误 ({}): {}", consecutive_errors, e);
                    if consecutive_errors > 10 {
                        break;
                    }
                }
            }
            
            // 检查是否有前端发来的数据
            while let Ok(data) = rx.try_recv() {
                if let Err(e) = channel.write_all(data.as_bytes()) {
                    println!("写入错误: {}", e);
                }
                if let Err(e) = channel.flush() {
                    println!("刷新错误: {}", e);
                }
            }
            
            // 检查 channel 是否已关闭
            if channel.eof() {
                println!("Channel EOF");
                break;
            }
            
            thread::sleep(std::time::Duration::from_millis(10));
        }
        
        // 断开连接
        let _ = app.emit("terminal-event", serde_json::json!({
            "termId": term_id,
            "type": "status",
            "status": "disconnected"
        }));
    });
    
    Ok(tx)
}

#[tauri::command]
pub async fn connect_terminal(
    app: tauri::AppHandle,
    terminal_sessions: State<'_, SharedTerminalSessions>,
    connection_id: String,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    let term_id = uuid::Uuid::new_v4().to_string();

    // 获取连接信息
    let conn_info = crate::connection::find_connection(&connection_id)
        .ok_or_else(|| "连接不存在".to_string())?;

    let conn = ConnectionInfo {
        host: conn_info.host.clone(),
        port: conn_info.port,
        username: conn_info.username.clone(),
        password: conn_info.password.clone(),
        private_key: conn_info.private_key.clone(),
        auth_type: match conn_info.auth_type {
            crate::models::AuthType::Key => "key".to_string(),
            _ => "password".to_string(),
        },
    };

    // 启动后台 SSH 线程，获取 sender
    let sender = spawn_ssh_thread(conn, cols, rows, term_id.clone(), app.clone())?;

    // 存储会话
    {
        let mut sessions = terminal_sessions.sessions.lock().await;
        sessions.insert(term_id.clone(), sender);
    }

    Ok(term_id)
}

#[tauri::command]
pub async fn send_data(
    terminal_sessions: State<'_, SharedTerminalSessions>,
    term_id: String,
    data: String,
) -> Result<(), String> {
    let sessions = terminal_sessions.sessions.lock().await;
    if let Some(sender) = sessions.get(&term_id) {
        sender.send(data).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn resize_terminal(
    _terminal_sessions: State<'_, SharedTerminalSessions>,
    term_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    println!("resize_terminal called: term_id={}, cols={}, rows={}", term_id, cols, rows);
    // PTY resize 需要重新打开 channel，目前简化处理
    Ok(())
}

#[tauri::command]
pub async fn disconnect_terminal(
    terminal_sessions: State<'_, SharedTerminalSessions>,
    term_id: String,
) -> Result<(), String> {
    let mut sessions = terminal_sessions.sessions.lock().await;
    sessions.remove(&term_id);
    Ok(())
}
