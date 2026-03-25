use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Local};
use crate::models::get_data_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandEntry {
    pub id: String,
    pub connection_id: String,
    pub connection_name: String,
    pub host: String,
    pub command: String,
    pub timestamp: DateTime<Local>,
    pub session_start: DateTime<Local>,
}

#[derive(Debug, Serialize)]
pub struct CommandHistory {
    pub commands: Vec<CommandEntry>,
    pub total: usize,
}

fn get_history_file() -> PathBuf {
    let mut path = get_data_dir();
    path.push("command_history.json");
    path
}

fn read_history() -> Vec<CommandEntry> {
    let file = get_history_file();
    if !file.exists() {
        return Vec::new();
    }
    
    match fs::read_to_string(&file) {
        Ok(content) => {
            serde_json::from_str(&content).unwrap_or_default()
        }
        Err(_) => Vec::new(),
    }
}

fn write_history(commands: &[CommandEntry]) -> Result<(), String> {
    let file = get_history_file();
    
    // 确保目录存在
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let content = serde_json::to_string_pretty(commands)
        .map_err(|e| e.to_string())?;
    fs::write(&file, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 保存命令到历史记录
#[tauri::command]
pub async fn save_command(
    connection_id: String,
    connection_name: String,
    host: String,
    command: String,
    session_start: DateTime<Local>,
) -> Result<(), String> {
    let mut history = read_history();
    
    let entry = CommandEntry {
        id: uuid::Uuid::new_v4().to_string(),
        connection_id,
        connection_name,
        host,
        command: command.trim().to_string(),
        timestamp: Local::now(),
        session_start,
    };
    
    // 避免连续重复命令
    if let Some(last) = history.last() {
        if last.command == entry.command && last.connection_id == entry.connection_id {
            return Ok(());
        }
    }
    
    history.push(entry);
    
    // 限制历史记录数量（保留最近 10000 条）
    if history.len() > 10000 {
        history = history.split_off(history.len() - 10000);
    }
    
    write_history(&history)
}

/// 获取命令历史
#[tauri::command]
pub async fn get_command_history(
    connection_id: Option<String>,
    search: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<CommandHistory, String> {
    let history = read_history();
    
    let mut commands: Vec<CommandEntry> = history.into_iter()
        .filter(|cmd| {
            // 按连接筛选
            if let Some(ref conn_id) = connection_id {
                if cmd.connection_id != *conn_id {
                    return false;
                }
            }
            // 按搜索词筛选
            if let Some(ref search_term) = search {
                let term = search_term.to_lowercase();
                if !cmd.command.to_lowercase().contains(&term) &&
                   !cmd.connection_name.to_lowercase().contains(&term) &&
                   !cmd.host.to_lowercase().contains(&term) {
                    return false;
                }
            }
            true
        })
        .rev() // 最新的在前
        .collect();
    
    let total = commands.len();
    
    // 分页
    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(100);
    
    if offset < commands.len() {
        let end = (offset + limit).min(commands.len());
        commands = commands[offset..end].to_vec();
    } else {
        commands.clear();
    }
    
    Ok(CommandHistory { commands, total })
}

/// 获取常用命令统计
#[tauri::command]
pub async fn get_frequent_commands(
    connection_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<(String, usize)>, String> {
    let history = read_history();
    
    use std::collections::HashMap;
    let mut freq: HashMap<String, usize> = HashMap::new();
    
    for cmd in history {
        if let Some(ref conn_id) = connection_id {
            if cmd.connection_id != *conn_id {
                continue;
            }
        }
        *freq.entry(cmd.command).or_insert(0) += 1;
    }
    
    let mut result: Vec<(String, usize)> = freq.into_iter().collect();
    result.sort_by(|a, b| b.1.cmp(&a.1)); // 按频率降序
    
    let limit = limit.unwrap_or(20);
    result.truncate(limit);
    
    Ok(result)
}

/// 清空历史记录
#[tauri::command]
pub async fn clear_command_history(connection_id: Option<String>) -> Result<(), String> {
    if let Some(conn_id) = connection_id {
        // 只清空指定连接的历史
        let history = read_history();
        let filtered: Vec<CommandEntry> = history
            .into_iter()
            .filter(|cmd| cmd.connection_id != conn_id)
            .collect();
        write_history(&filtered)
    } else {
        // 清空所有历史
        let file = get_history_file();
        if file.exists() {
            fs::remove_file(&file).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

/// 导出历史到文件
#[tauri::command]
pub async fn export_command_history(format: String) -> Result<String, String> {
    let history = read_history();
    
    match format.as_str() {
        "json" => {
            let content = serde_json::to_string_pretty(&history)
                .map_err(|e| e.to_string())?;
            Ok(content)
        }
        "txt" | "text" => {
            let mut content = String::new();
            for cmd in history {
                content.push_str(&format!(
                    "[{}] {}@{}: {}\n",
                    cmd.timestamp.format("%Y-%m-%d %H:%M:%S"),
                    cmd.connection_name,
                    cmd.host,
                    cmd.command
                ));
            }
            Ok(content)
        }
        _ => Err("不支持的格式".to_string()),
    }
}
