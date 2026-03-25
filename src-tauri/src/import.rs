/// 解析并导入 Xshell 导出的会话文件
/// 支持：.xsh（单个会话 INI 格式）、.xts（多会话打包）、.csv（批量导出）

use crate::models::{Connection, AuthType};
use std::collections::HashMap;

/// 解析结果
#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedConnection {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    pub group: String,
    pub description: String,
}

/// 解析 .xsh 文件内容（INI 格式）
/// [Connection]
/// Host=192.168.1.1
/// Port=22
/// [Authentication]
/// UserName=root
pub fn parse_xsh(content: &str) -> Option<ImportedConnection> {
    let sections = parse_ini(content);
    
    eprintln!("[import] parse_xsh: 找到 {} 个 section", sections.len());
    for (k, v) in &sections {
        let keys: Vec<_> = v.keys().collect();
        eprintln!("[import]   section '{}': {:?}", k, &keys[..keys.len().min(10)]);
    }

    // 优先使用 _global section（包含所有顶层键值对）
    let global = sections.get("_global");
    
    // 查找 host - 尝试多种可能的来源
    let host = global
        .and_then(|s| s.get("host"))
        .map(|s| s.trim().to_string())
        .or_else(|| {
            // 查找所有 section 中的 host
            sections.values()
                .find_map(|sec| sec.get("host"))
                .map(|s| s.trim().to_string())
        })?;

    if host.is_empty() {
        eprintln!("[import] host 为空");
        return None;
    }

    // 查找 port
    let port: u16 = global
        .and_then(|s| s.get("port"))
        .and_then(|p| p.trim().parse().ok())
        .or_else(|| {
            sections.values()
                .find_map(|sec| sec.get("port").and_then(|p| p.trim().parse().ok()))
        })
        .unwrap_or(22);

    // 查找 username
    let username = global
        .and_then(|s| s.get("username").or_else(|| s.get("user")))
        .or_else(|| {
            sections.values()
                .find_map(|sec| sec.get("username").or_else(|| sec.get("user")))
        })
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    // 查找认证方式（从所有 section 中找）
    let auth_method = sections.values()
        .find_map(|sec| {
            sec.get("method")
                .or_else(|| sec.get("authmethod"))
                .or_else(|| sec.get("authentication"))
        })
        .map(|s| s.trim().to_lowercase())
        .unwrap_or_default();

    let auth_type = if auth_method.contains("publickey") || auth_method.contains("public-key") || auth_method.contains("key") {
        "key".to_string()
    } else {
        "password".to_string()
    };

    // 查找描述
    let description = global
        .and_then(|s| s.get("description"))
        .or_else(|| {
            sections.values()
                .find_map(|sec| sec.get("description"))
        })
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    // 取主机名或描述作为默认名称
    let name = if !description.is_empty() {
        description.clone()
    } else {
        host.clone()
    };

    // 分组
    let group = sections.values()
        .find_map(|sec| {
            sec.get("folder")
                .or_else(|| sec.get("category"))
                .or_else(|| sec.get("group"))
        })
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "Xshell导入".to_string());

    eprintln!("[import] parse_xsh 成功: name={}, host={}, port={}, user={}", name, host, port, username);

    Some(ImportedConnection {
        name,
        host,
        port,
        username,
        auth_type,
        group,
        description,
    })
}

/// 解析 .xts 文件（多个 .xsh 拼接，每个以空行分隔，或 zip 打包）
/// Xshell 导出的 .xts 实际上是 zip 格式，里面是多个 .xsh 文件
pub fn parse_xts(data: &[u8]) -> Vec<ImportedConnection> {
    // 先尝试当 zip 处理（Xshell 7+ 的 .xts 是 zip）
    eprintln!("[import] 尝试解析 .xts 为 zip 格式...");
    match parse_xts_zip(data) {
        Ok(results) => {
            eprintln!("[import] zip 解析成功，找到 {} 个连接", results.len());
            return results;
        }
        Err(e) => {
            eprintln!("[import] zip 解析失败: {}，尝试文本格式...", e);
        }
    }

    // 降级：当纯文本多段处理（Xshell 5 格式）
    let content = String::from_utf8_lossy(data);
    eprintln!("[import] 尝试文本解析，内容长度: {}", content.len());
    parse_xts_text(&content)
}

fn parse_xts_zip(data: &[u8]) -> Result<Vec<ImportedConnection>, String> {
    use std::io::Read;
    let cursor = std::io::Cursor::new(data);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("zip 初始化失败: {}", e))?;
    
    eprintln!("[import] zip 文件包含 {} 个条目", archive.len());
    
    let mut results = Vec::new();
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("读取 zip 条目 {} 失败: {}", i, e))?;
        let name_raw = file.name_raw();
        // 尝试解码文件名（可能是 UTF-16 LE）
        let name = decode_filename(name_raw);
        eprintln!("[import] zip 条目 {}: {}", i, name);
        
        if name.ends_with(".xsh") {
            // 读取原始字节
            let mut raw_bytes = Vec::new();
            file.read_to_end(&mut raw_bytes).ok();
            
            // 尝试 UTF-16 LE 解码（Xshell 默认格式）
            let content = decode_xshell_content(&raw_bytes);
            eprintln!("[import] .xsh 内容前200字符: {}", &content[..content.len().min(200)]);
            
            if let Some(mut conn) = parse_xsh(&content) {
                // 用文件名（去掉 .xsh）作为连接名
                if conn.name == conn.host || conn.name.is_empty() {
                    let file_stem = std::path::Path::new(&name)
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or(&name);
                    conn.name = file_stem.to_string();
                }
                eprintln!("[import] 解析成功: {}@{}:{}", conn.username, conn.host, conn.port);
                results.push(conn);
            } else {
                eprintln!("[import] 无法从 .xsh 解析连接");
            }
        }
    }
    Ok(results)
}

/// 解码 zip 中的文件名（可能是 UTF-16 LE 或 GBK/GB2312）
fn decode_filename(data: &[u8]) -> String {
    // 检查 UTF-16 LE BOM
    if data.starts_with(&[0xFF, 0xFE]) {
        return decode_utf16_le(&data[2..]);
    }
    // 检查 UTF-16 BE BOM
    if data.starts_with(&[0xFE, 0xFF]) {
        return decode_utf16_be(&data[2..]);
    }
    
    // 如果包含大量 0x00，可能是 UTF-16 LE
    if data.len() >= 2 && data.len() % 2 == 0 {
        let null_count = data.iter().filter(|&&b| b == 0).count();
        let ratio = null_count as f32 / data.len() as f32;
        if ratio > 0.3 {
            return decode_utf16_le(data);
        }
    }
    
    // 尝试 GBK/GB2312 解码（Xshell 中文文件名常用）
    // 检测是否包含 GBK 常见中文字节范围
    if data.iter().any(|&b| b >= 0x80) {
        // 尝试 GBK 解码
        if let Ok(s) = decode_gbk(data) {
            return s;
        }
    }
    
    // 默认 UTF-8
    String::from_utf8_lossy(data).to_string()
}

/// 将 GBK/GB2312 字节解码为 String
fn decode_gbk(data: &[u8]) -> Result<String, String> {
    // 使用 encoding_rs 库进行 GBK 解码
    let (cow, _, had_errors) = encoding_rs::GBK.decode(data);
    if had_errors {
        Err("GBK decode error".to_string())
    } else {
        Ok(cow.to_string())
    }
}

/// 解码 Xshell 文件内容
/// Xshell 的 .xsh 文件可能是 UTF-16 LE 或 UTF-8
fn decode_xshell_content(data: &[u8]) -> String {
    // 检查 BOM
    if data.starts_with(&[0xFF, 0xFE]) {
        // UTF-16 LE BOM
        return decode_utf16_le(&data[2..]);
    }
    if data.starts_with(&[0xFE, 0xFF]) {
        // UTF-16 BE BOM
        return decode_utf16_be(&data[2..]);
    }
    
    // 尝试检测 UTF-16 LE（常见情况：偶数长度，且有很多 0x00）
    if data.len() >= 4 && data.len() % 2 == 0 {
        let null_count = data.iter().filter(|&&b| b == 0).count();
        let ratio = null_count as f32 / data.len() as f32;
        if ratio > 0.3 {
            // 很可能是 UTF-16 LE
            return decode_utf16_le(data);
        }
    }
    
    // 默认按 UTF-8 处理
    String::from_utf8_lossy(data).to_string()
}

/// 将 UTF-16 LE 字节解码为 String
fn decode_utf16_le(data: &[u8]) -> String {
    let u16_vec: Vec<u16> = data.chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .collect();
    String::from_utf16(&u16_vec).unwrap_or_default()
}

/// 将 UTF-16 BE 字节解码为 String
fn decode_utf16_be(data: &[u8]) -> String {
    let u16_vec: Vec<u16> = data.chunks_exact(2)
        .map(|c| u16::from_be_bytes([c[0], c[1]]))
        .collect();
    String::from_utf16(&u16_vec).unwrap_or_default()
}

fn parse_xts_text(content: &str) -> Vec<ImportedConnection> {
    // 按 [Connection] 或 [Session] 分段
    let mut results = Vec::new();
    let mut current = String::new();

    for line in content.lines() {
        let trimmed = line.trim();
        let is_section_start = trimmed.eq_ignore_ascii_case("[connection]")
            || trimmed.eq_ignore_ascii_case("[session]");

        if is_section_start && !current.is_empty() {
            if let Some(conn) = parse_xsh(&current) {
                results.push(conn);
            }
            current.clear();
        }
        current.push_str(line);
        current.push('\n');
    }
    if !current.trim().is_empty() {
        if let Some(conn) = parse_xsh(&current) {
            results.push(conn);
        }
    }
    results
}

/// 解析 .csv 格式（Xshell 导出的 CSV）
/// 通常格式：Name,Host,Port,Username,Protocol,Description
pub fn parse_csv(content: &str) -> Vec<ImportedConnection> {
    let mut results = Vec::new();
    let mut lines = content.lines();

    // 跳过并解析标题行
    let header_line = match lines.next() {
        Some(h) => h.to_lowercase(),
        None => return results,
    };

    // 找到各列索引（不区分大小写）
    let headers: Vec<&str> = header_line.split(',').map(|s| s.trim()).collect();
    let idx = |name: &str| -> Option<usize> {
        headers.iter().position(|&h| h.contains(name))
    };

    let i_name = idx("name").or_else(|| idx("session"));
    let i_host = idx("host").or_else(|| idx("hostname").or_else(|| idx("address")));
    let i_port = idx("port");
    let i_user = idx("user").or_else(|| idx("login").or_else(|| idx("account")));
    let i_desc = idx("desc").or_else(|| idx("comment").or_else(|| idx("note")));
    let i_folder = idx("folder").or_else(|| idx("group").or_else(|| idx("category")));

    let get = |fields: &[&str], idx: Option<usize>| -> String {
        idx.and_then(|i| fields.get(i)).map(|s| s.trim().trim_matches('"').to_string()).unwrap_or_default()
    };

    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = line.split(',').collect();
        let host = get(&fields, i_host);
        if host.is_empty() {
            continue;
        }

        let name_val = get(&fields, i_name);
        let name = if name_val.is_empty() { host.clone() } else { name_val };
        let port: u16 = get(&fields, i_port).parse().unwrap_or(22);
        let username = get(&fields, i_user);
        let description = get(&fields, i_desc);
        let group = {
            let g = get(&fields, i_folder);
            if g.is_empty() { "Xshell导入".to_string() } else { g }
        };

        results.push(ImportedConnection {
            name,
            host,
            port,
            username,
            auth_type: "password".to_string(),
            group,
            description,
        });
    }
    results
}

/// 核心 INI 解析器（小型，不依赖第三方库）
/// 支持 Xshell 格式：[CONNECTION:SSH] 这种带冒号的 section
fn parse_ini(content: &str) -> HashMap<String, HashMap<String, String>> {
    let mut sections: HashMap<String, HashMap<String, String>> = HashMap::new();
    let mut current_section = "default".to_string();
    let mut global_entries: HashMap<String, String> = HashMap::new();

    for line in content.lines() {
        let line = line.trim();
        // 注释
        if line.starts_with(';') || line.starts_with('#') || line.is_empty() {
            continue;
        }
        // section 标题 - 支持 [NAME] 和 [NAME:SUBNAME] 格式
        if line.starts_with('[') && line.ends_with(']') {
            current_section = line[1..line.len() - 1].trim().to_lowercase();
            continue;
        }
        // 键值对
        if let Some(pos) = line.find('=') {
            let key = line[..pos].trim().to_lowercase();
            let value = line[pos + 1..].trim().to_string();
            
            // Host/Port/Protocol 等关键字段也保存到全局，方便查找
            if ["host", "port", "protocol", "username", "user", "description"].contains(&key.as_str()) {
                global_entries.insert(key.clone(), value.clone());
            }
            
            sections
                .entry(current_section.clone())
                .or_default()
                .insert(key, value);
        }
    }
    
    // 把全局字段也作为一个 section，方便统一查找
    if !global_entries.is_empty() {
        sections.insert("_global".to_string(), global_entries);
    }
    
    sections
}

// ── Tauri 命令 ──────────────────────────────────────────────────

/// 解析文件内容，返回连接预览列表（不保存）
#[tauri::command]
pub fn parse_import_file(
    file_name: String,
    file_data: Vec<u8>,
) -> Result<Vec<ImportedConnection>, String> {
    let lower = file_name.to_lowercase();

    if lower.ends_with(".xsh") {
        let content = decode_xshell_content(&file_data);
        match parse_xsh(&content) {
            Some(conn) => Ok(vec![conn]),
            None => Err("无法解析 .xsh 文件，请确认文件格式正确".to_string()),
        }
    } else if lower.ends_with(".xts") {
        let results = parse_xts(&file_data);
        if results.is_empty() {
            Err("未找到有效的连接配置".to_string())
        } else {
            Ok(results)
        }
    } else if lower.ends_with(".csv") {
        let content = String::from_utf8_lossy(&file_data).to_string();
        let results = parse_csv(&content);
        if results.is_empty() {
            Err("CSV 中未找到有效的连接配置".to_string())
        } else {
            Ok(results)
        }
    } else {
        Err(format!("不支持的文件格式: {lower}，请使用 .xsh / .xts / .csv"))
    }
}

/// 批量导入连接（确认后调用）
/// 注意：导入时密码始终为空，因为 Xshell 的密码是加密的无法解密
/// 同一 IP:端口 的连接不会重复导入
#[tauri::command]
pub fn batch_import_connections(
    connections: Vec<ImportedConnection>,
) -> Result<Vec<Connection>, String> {
    use crate::connection;
    use crate::models::ConnectionForCreate;
    use std::collections::HashSet;

    // 获取现有连接，检查重复的 IP:端口
    let existing_connections = connection::get_all_connections().unwrap_or_default();
    let existing_keys: HashSet<String> = existing_connections
        .iter()
        .map(|c| format!("{}:{}", c.host, c.port))
        .collect();

    let mut imported = Vec::new();
    let mut skipped = 0;

    for item in connections {
        // 检查是否已存在相同的 IP:端口
        let key = format!("{}:{}", item.host, item.port);
        if existing_keys.contains(&key) {
            eprintln!("[import] 跳过重复连接: {} ({}:{})", item.name, item.host, item.port);
            skipped += 1;
            continue;
        }
        let auth_type = if item.auth_type == "key" {
            AuthType::Key
        } else {
            AuthType::Password
        };

        // 导入时密码始终为空，因为 Xshell 密码是加密的无法解密
        // 用户需要在导入后手动填写密码
        let conn_data = ConnectionForCreate {
            name: item.name,
            host: item.host,
            port: item.port,
            username: item.username,
            password: None,  // 密码为空，需要用户手动填写
            private_key: None,
            auth_type,
            group: item.group,
        };

        match connection::create_connection(conn_data) {
            Ok(conn) => {
                imported.push(conn);
            }
            Err(e) => eprintln!("导入连接失败: {}", e),
        }
    }

    if skipped > 0 {
        eprintln!("[import] 导入完成: {} 个成功, {} 个重复已跳过", imported.len(), skipped);
    }

    Ok(imported)
}
