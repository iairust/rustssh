use crate::models::FileInfo;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;

// 获取 SSH 会话的辅助函数
fn get_ssh_session(connection_id: &str) -> Result<ssh2::Session, String> {
    let conn = crate::connection::find_connection(connection_id)
        .ok_or_else(|| "连接不存在".to_string())?;

    let addr = format!("{}:{}", conn.host, conn.port);
    let tcp = TcpStream::connect(&addr).map_err(|e| e.to_string())?;
    tcp.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();

    let mut session = ssh2::Session::new().map_err(|e| e.to_string())?;
    session.set_tcp_stream(tcp);
    session.handshake().map_err(|e| e.to_string())?;

    // 认证
    match conn.auth_type {
        crate::models::AuthType::Key => {
            let key = conn.private_key.as_deref().unwrap_or("");
            if !key.is_empty() {
                let temp_dir = std::env::temp_dir();
                let key_path = temp_dir.join(format!("ssh_key_{}", uuid::Uuid::new_v4()));
                std::fs::write(&key_path, key).map_err(|e| e.to_string())?;
                let result = session.userauth_pubkey_file(&conn.username, None, &key_path, None);
                let _ = std::fs::remove_file(key_path);
                result.map_err(|e| e.to_string())?;
            }
        }
        crate::models::AuthType::Password => {
            let pw = conn.password.as_deref().unwrap_or("");
            session.userauth_password(&conn.username, pw).map_err(|e| e.to_string())?;
        }
    }

    if !session.authenticated() {
        return Err("认证失败".to_string());
    }

    Ok(session)
}

#[tauri::command]
pub fn list_directory(connection_id: String, path: String) -> Result<Vec<FileInfo>, String> {
    let session = get_ssh_session(&connection_id)?;

    let sftp = session.sftp().map_err(|e| e.to_string())?;

    // 使用 readdir 读取目录
    let dir = sftp.readdir(Path::new(&path)).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for (file_path, stat) in dir {
        let name = file_path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        
        if name == "." || name == ".." {
            continue;
        }

        // FileStat 字段访问
        let size = stat.size.unwrap_or(0);
        let mtime = stat.mtime.unwrap_or(0) as i64;
        let file_type = if stat.perm.unwrap_or(0) & 0o40000 != 0 { 
            "d".to_string() 
        } else { 
            "-".to_string() 
        };

        entries.push(FileInfo {
            name,
            size,
            modify_time: mtime,
            file_type,
            permissions: String::new(),
        });
    }

    Ok(entries)
}

#[tauri::command]
pub fn download_file(
    connection_id: String, 
    remote_path: String,
    save_path: Option<String>
) -> Result<String, String> {
    let session = get_ssh_session(&connection_id)?;

    let sftp = session.sftp().map_err(|e| e.to_string())?;

    let mut file = sftp.open(Path::new(&remote_path)).map_err(|e| e.to_string())?;

    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|e| e.to_string())?;

    // 保存到指定路径或下载目录
    let local_path = if let Some(path) = save_path {
        path
    } else {
        let file_name = Path::new(&remote_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("download");
        let download_dir = dirs::download_dir()
            .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
            .unwrap_or_else(|| std::env::temp_dir());
        download_dir.join(file_name).to_string_lossy().to_string()
    };

    std::fs::write(&local_path, &contents).map_err(|e| format!("保存文件失败: {}", e))?;

    Ok(local_path)
}

#[tauri::command]
pub fn upload_file(
    connection_id: String, 
    remote_path: String,
    file_data: Vec<u8>
) -> Result<(), String> {
    let session = get_ssh_session(&connection_id)?;

    let sftp = session.sftp().map_err(|e| e.to_string())?;

    let mut file = sftp.create(Path::new(&remote_path)).map_err(|e| e.to_string())?;
    file.write_all(&file_data).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_path(connection_id: String, path: String) -> Result<(), String> {
    let session = get_ssh_session(&connection_id)?;

    let sftp = session.sftp().map_err(|e| e.to_string())?;
    let p = Path::new(&path);

    // 尝试删除文件
    if sftp.unlink(p).is_ok() {
        return Ok(());
    }

    // 尝试删除目录
    sftp.rmdir(p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_directory(connection_id: String, path: String) -> Result<(), String> {
    let session = get_ssh_session(&connection_id)?;

    let sftp = session.sftp().map_err(|e| e.to_string())?;
    sftp.mkdir(Path::new(&path), 0o755).map_err(|e| e.to_string())
}
