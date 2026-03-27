use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 获取应用数据目录
pub fn get_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| std::env::temp_dir())
        .join("rustssh")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private_key: Option<String>,
    #[serde(default = "default_auth_type")]
    pub auth_type: AuthType,
    #[serde(default = "default_group")]
    pub group: String,
    #[serde(default)]
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionForTest {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub private_key: Option<String>,
    #[serde(default = "default_auth_type")]
    pub auth_type: AuthType,
    #[serde(default = "default_group")]
    pub group: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionForCreate {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub private_key: Option<String>,
    #[serde(default = "default_auth_type")]
    pub auth_type: AuthType,
    #[serde(default = "default_group")]
    pub group: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionForUpdate {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub private_key: Option<String>,
    #[serde(default = "default_auth_type")]
    pub auth_type: AuthType,
    #[serde(default = "default_group")]
    pub group: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AuthType {
    Password,
    Key,
}

fn default_auth_type() -> AuthType { AuthType::Password }
fn default_group() -> String { "default".to_string() }

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionWithoutSecret {
    #[serde(flatten)]
    pub conn: Connection,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub size: u64,
    pub modify_time: i64,
    #[serde(rename = "type")]
    pub file_type: String, // "d" dir, "-" file, "l" link
    pub permissions: String,
}
