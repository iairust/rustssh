use crate::models::{Connection, AuthType, TestResult, ConnectionForTest, ConnectionForCreate, ConnectionForUpdate};
use std::path::PathBuf;
use std::fs;
use std::sync::Mutex;

// 连接数据存储文件路径
fn get_connections_file() -> PathBuf {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("xshell");
    fs::create_dir_all(&data_dir).ok();
    data_dir.join("connections.json")
}

// 线程安全的文件锁
static FILE_LOCK: Mutex<()> = Mutex::new(());

// 读取所有连接
fn read_connections() -> Vec<Connection> {
    let _lock = FILE_LOCK.lock().unwrap();
    let path = get_connections_file();
    if !path.exists() {
        return Vec::new();
    }
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

// 保存所有连接
fn save_connections(connections: &[Connection]) -> Result<(), String> {
    let _lock = FILE_LOCK.lock().unwrap();
    let path = get_connections_file();
    let content = serde_json::to_string_pretty(connections).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

// 根据 ID 查找连接
pub fn find_connection(id: &str) -> Option<Connection> {
    read_connections().into_iter().find(|c| c.id == id)
}

#[tauri::command]
pub fn get_all_connections() -> Result<Vec<Connection>, String> {
    Ok(read_connections())
}

#[tauri::command]
pub fn get_connection(id: String) -> Result<Connection, String> {
    find_connection(&id).ok_or_else(|| "连接不存在".to_string())
}

#[tauri::command]
pub fn create_connection(conn: ConnectionForCreate) -> Result<Connection, String> {
    let mut connections = read_connections();
    
    let new_conn = Connection {
        id: uuid::Uuid::new_v4().to_string(),
        name: conn.name,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        password: conn.password,
        private_key: conn.private_key,
        auth_type: conn.auth_type,
        group: conn.group,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    
    connections.push(new_conn.clone());
    save_connections(&connections)?;
    
    Ok(new_conn)
}

#[tauri::command]
pub fn update_connection(id: String, updates: ConnectionForUpdate) -> Result<Connection, String> {
    let mut connections = read_connections();
    
    let conn = connections.iter_mut()
        .find(|c| c.id == id)
        .ok_or_else(|| "连接不存在".to_string())?;
    
    if !updates.name.is_empty() { conn.name = updates.name; }
    if !updates.host.is_empty() { conn.host = updates.host; }
    if updates.port > 0 { conn.port = updates.port; }
    if !updates.username.is_empty() { conn.username = updates.username; }
    if updates.password.is_some() { conn.password = updates.password; }
    if updates.private_key.is_some() { conn.private_key = updates.private_key; }
    conn.auth_type = updates.auth_type;
    if !updates.group.is_empty() { conn.group = updates.group; }
    
    let updated = conn.clone();
    save_connections(&connections)?;
    
    Ok(updated)
}

#[tauri::command]
pub fn delete_connection(id: String) -> Result<(), String> {
    let mut connections = read_connections();
    let initial_len = connections.len();
    connections.retain(|c| c.id != id);
    
    if connections.len() == initial_len {
        return Err("连接不存在".to_string());
    }
    
    save_connections(&connections)
}

#[tauri::command]
pub fn test_connection(conn: ConnectionForTest) -> Result<TestResult, String> {
    use std::time::Duration;
    use std::net::TcpStream;
    use ssh2::Session;

    // 基本验证
    if conn.host.is_empty() || conn.username.is_empty() {
        return Ok(TestResult {
            success: false,
            error: Some("主机地址和用户名不能为空".to_string()),
        });
    }

    // 验证认证信息
    match conn.auth_type {
        AuthType::Password if conn.password.as_ref().map(|p| p.is_empty()).unwrap_or(true) => {
            return Ok(TestResult {
                success: false,
                error: Some("密码不能为空".to_string()),
            });
        }
        AuthType::Key if conn.private_key.as_ref().map(|k| k.is_empty()).unwrap_or(true) => {
            return Ok(TestResult {
                success: false,
                error: Some("私钥内容不能为空".to_string()),
            });
        }
        _ => {}
    }

    let addr = format!("{}:{}", conn.host, conn.port);
    
    // TCP 连接 (使用超时)
    let tcp = match TcpStream::connect(&addr) {
        Ok(t) => {
            t.set_read_timeout(Some(Duration::from_secs(10))).ok();
            t.set_write_timeout(Some(Duration::from_secs(10))).ok();
            t
        }
        Err(e) => {
            return Ok(TestResult {
                success: false,
                error: Some(format!("无法连接到 {}: {}", addr, e)),
            });
        }
    };

    // SSH 会话
    let mut session = match Session::new() {
        Ok(s) => s,
        Err(e) => {
            return Ok(TestResult {
                success: false,
                error: Some(format!("创建 SSH 会话失败: {}", e)),
            });
        }
    };

    session.set_tcp_stream(tcp);
    
    if let Err(e) = session.handshake() {
        return Ok(TestResult {
            success: false,
            error: Some(format!("SSH 握手失败: {}", e)),
        });
    }

    // 认证
    let auth_result = match conn.auth_type {
        AuthType::Password => {
            session.userauth_password(
                &conn.username,
                conn.password.as_deref().unwrap_or("")
            )
        }
        AuthType::Key => {
            // 密钥认证需要临时文件
            let key = conn.private_key.as_deref().unwrap_or("");
            if key.is_empty() {
                return Ok(TestResult {
                    success: false,
                    error: Some("私钥内容为空".to_string()),
                });
            }
            
            // 写入临时文件（加 .pem 扩展名确保兼容性）
            let temp_dir = std::env::temp_dir();
            let key_path = temp_dir.join(format!("ssh_key_{}.pem", uuid::Uuid::new_v4()));
            std::fs::write(&key_path, key).map_err(|e| e.to_string())?;
            
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
    };

    // 检查认证结果
    match auth_result {
        Ok(()) => {
            if session.authenticated() {
                Ok(TestResult {
                    success: true,
                    error: None,
                })
            } else {
                Ok(TestResult {
                    success: false,
                    error: Some("认证失败".to_string()),
                })
            }
        }
        Err(e) => Ok(TestResult {
            success: false,
            error: Some(format!("认证错误: {}", e)),
        }),
    }
}
