use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, State, Manager};
use chrono::Utc;
use uuid::Uuid;
use anyhow::{Result, anyhow};
use reqwest;
use rusqlite::{params, Connection};
use std::sync::Mutex;

/// Relay station adapter type for different station implementations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RelayStationAdapter {
    Newapi,
    Oneapi,
    Custom,
}

/// Authentication method for relay stations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthMethod {
    BearerToken,
    ApiKey,
    Custom,
}

/// Represents a relay station configuration for creation (without generated fields)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRelayStationRequest {
    pub name: String,
    pub description: Option<String>,
    pub api_url: String,
    pub adapter: RelayStationAdapter,
    pub auth_method: AuthMethod,
    pub system_token: String,
    pub user_id: Option<String>, // For NewAPI stations, this is required
    pub adapter_config: Option<HashMap<String, serde_json::Value>>,
    pub enabled: bool,
}

/// Represents a relay station configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayStation {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub api_url: String,
    pub adapter: RelayStationAdapter,
    pub auth_method: AuthMethod,
    pub system_token: String,
    pub user_id: Option<String>, // For NewAPI stations, this is required
    pub adapter_config: Option<HashMap<String, serde_json::Value>>,
    pub enabled: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Station information retrieved from the relay station
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StationInfo {
    pub name: String,
    pub announcement: Option<String>,
    pub api_url: String,
    pub version: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub quota_per_unit: Option<i64>, // Added for price conversion
}

/// Token configuration for a relay station
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayStationToken {
    pub id: String,
    pub station_id: String,
    pub name: String,
    pub token: String,
    pub user_id: Option<String>,
    pub enabled: bool,
    pub expires_at: Option<i64>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub created_at: i64,
}

/// User information retrieved from a relay station
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub user_id: String,
    pub username: Option<String>,
    pub email: Option<String>,
    pub balance_remaining: Option<f64>,
    pub amount_used: Option<f64>,
    pub request_count: Option<i64>,
    pub status: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Log entry from a relay station
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StationLogEntry {
    pub id: String,
    pub timestamp: i64,
    pub level: String,
    pub message: String,
    pub user_id: Option<String>,
    pub request_id: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    // Additional fields from NewAPI logs
    pub model_name: Option<String>,
    pub prompt_tokens: Option<i64>,
    pub completion_tokens: Option<i64>,
    pub quota: Option<i64>, // Cost/usage
    pub token_name: Option<String>,
    pub use_time: Option<i64>, // Response time in seconds
    pub is_stream: Option<bool>,
    pub channel: Option<i64>,
    pub group: Option<String>,
}

/// Log pagination response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogPaginationResponse {
    pub items: Vec<StationLogEntry>,
    pub page: usize,
    pub page_size: usize,
    pub total: i64,
}

/// Connection test result for a relay station
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub response_time: Option<u64>,
    pub message: String,
    pub status_code: Option<u16>,
    pub details: Option<HashMap<String, serde_json::Value>>,
}

/// Request structure for creating a new token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTokenRequest {
    pub name: String,
    pub remain_quota: Option<i64>,
    pub expired_time: Option<i64>,
    pub unlimited_quota: Option<bool>,
    pub model_limits_enabled: Option<bool>,
    pub model_limits: Option<String>,
    pub group: Option<String>,
    pub allow_ips: Option<String>,
}

/// Request structure for updating an existing token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTokenRequest {
    pub id: i64,
    pub name: Option<String>,
    pub remain_quota: Option<i64>,
    pub expired_time: Option<i64>,
    pub unlimited_quota: Option<bool>,
    pub model_limits_enabled: Option<bool>,
    pub model_limits: Option<String>,
    pub group: Option<String>,
    pub allow_ips: Option<String>,
}

/// Adapter trait for different relay station implementations
#[async_trait::async_trait]
pub trait StationAdapter: Send + Sync {
    async fn get_station_info(&self, station: &RelayStation) -> Result<StationInfo>;
    async fn get_user_info(&self, station: &RelayStation, user_id: &str) -> Result<UserInfo>;
    async fn get_logs(&self, station: &RelayStation, page: Option<usize>, page_size: Option<usize>) -> Result<LogPaginationResponse>;
    async fn test_connection(&self, station: &RelayStation) -> Result<ConnectionTestResult>;
    
    // Token management methods
    async fn list_tokens(&self, station: &RelayStation, page: Option<usize>, size: Option<usize>) -> Result<Vec<RelayStationToken>>;
    async fn create_token(&self, station: &RelayStation, token_data: &CreateTokenRequest) -> Result<RelayStationToken>;
    async fn update_token(&self, station: &RelayStation, token_id: &str, token_data: &UpdateTokenRequest) -> Result<RelayStationToken>;
    async fn delete_token(&self, station: &RelayStation, token_id: &str) -> Result<()>;
}

/// NewAPI adapter implementation
pub struct NewApiAdapter;

#[async_trait::async_trait]
impl StationAdapter for NewApiAdapter {
    async fn get_station_info(&self, station: &RelayStation) -> Result<StationInfo> {
        let client = reqwest::Client::new();
        let user_id = station.user_id.as_deref().unwrap_or("1"); // Default to "1" if no user_id configured
        let response = client
            .get(&format!("{}/api/status", station.api_url))
            .header("New-API-User", user_id)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            let data_obj = data["data"].as_object().ok_or_else(|| anyhow!("Invalid response format"))?;
            
            Ok(StationInfo {
                name: data_obj.get("system_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&station.name)
                    .to_string(),
                announcement: data_obj.get("announcements")
                    .and_then(|v| v.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|first| first.get("content"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                api_url: station.api_url.clone(),
                version: data_obj.get("version")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                quota_per_unit: data_obj.get("quota_per_unit")
                    .and_then(|v| v.as_i64()),
                metadata: Some({
                    let mut map = HashMap::new();
                    map.insert("response".to_string(), data["data"].clone());
                    map
                }),
            })
        } else {
            Err(anyhow!("Failed to get station info: {}", response.status()))
        }
    }

    async fn get_user_info(&self, station: &RelayStation, user_id: &str) -> Result<UserInfo> {
        let client = reqwest::Client::new();
        let actual_user_id = if user_id.is_empty() {
            station.user_id.as_deref().unwrap_or("1")
        } else {
            user_id
        };
        
        let response = client
            .get(&format!("{}/api/user/self", station.api_url))
            .header("Authorization", &format!("Bearer {}", station.system_token))
            .header("New-API-User", actual_user_id)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            let user_data = data["data"].as_object().ok_or_else(|| anyhow!("Invalid response format"))?;
            
            Ok(UserInfo {
                user_id: user_data.get("id")
                    .and_then(|v| v.as_i64())
                    .map(|id| id.to_string())
                    .unwrap_or_else(|| user_id.to_string()),
                username: user_data.get("username")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                email: user_data.get("email")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string()),
                balance_remaining: user_data.get("quota")
                    .and_then(|v| v.as_i64())
                    .map(|q| q as f64 / 500000.0), // Convert to dollars (quota_per_unit from status)
                amount_used: user_data.get("used_quota")
                    .and_then(|v| v.as_i64())
                    .map(|q| q as f64 / 500000.0), // Convert to dollars
                request_count: user_data.get("request_count")
                    .and_then(|v| v.as_i64()),
                status: match user_data.get("status").and_then(|v| v.as_i64()) {
                    Some(1) => Some("active".to_string()),
                    Some(0) => Some("disabled".to_string()),
                    _ => Some("unknown".to_string()),
                },
                metadata: Some({
                    let mut map = HashMap::new();
                    map.insert("response".to_string(), data["data"].clone());
                    map
                }),
            })
        } else {
            Err(anyhow!("Failed to get user info: {}", response.status()))
        }
    }

    async fn get_logs(&self, station: &RelayStation, page: Option<usize>, page_size: Option<usize>) -> Result<LogPaginationResponse> {
        let client = reqwest::Client::new();
        let page = page.unwrap_or(1);
        let page_size = page_size.unwrap_or(10);
        let user_id = station.user_id.as_deref().unwrap_or("1");
        
        let url = format!(
            "{}/api/log/self?p={}&page_size={}&type=0&token_name=&model_name=&start_timestamp=0&end_timestamp={}&group=",
            station.api_url,
            page,
            page_size,
            chrono::Utc::now().timestamp()
        );

        let response = client
            .get(&url)
            .header("Authorization", &format!("Bearer {}", station.system_token))
            .header("New-API-User", user_id)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            let log_data = data["data"].as_object().ok_or_else(|| anyhow!("Invalid response format"))?;
            let empty_vec = vec![];
            let logs = log_data.get("items").and_then(|v| v.as_array()).unwrap_or(&empty_vec);
            
            let items = logs.iter().map(|log| {
                let empty_map = serde_json::Map::new();
                let log_obj = log.as_object().unwrap_or(&empty_map);
                
                // Parse the "other" field to get additional metrics
                let other_data: serde_json::Value = log_obj.get("other")
                    .and_then(|v| v.as_str())
                    .and_then(|s| serde_json::from_str(s).ok())
                    .unwrap_or(serde_json::Value::Null);
                
                StationLogEntry {
                    id: log_obj.get("id")
                        .and_then(|v| v.as_i64())
                        .map(|id| id.to_string())
                        .unwrap_or_default(),
                    timestamp: log_obj.get("created_at")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0),
                    level: match log_obj.get("type").and_then(|v| v.as_i64()) {
                        Some(1) => "info".to_string(),
                        Some(2) => "api".to_string(), // API call
                        Some(3) => "warn".to_string(),
                        Some(4) => "error".to_string(),
                        _ => "info".to_string(),
                    },
                    message: format!(
                        "API调用 - 模型: {} | 提示: {} | 补全: {} | 花费: {}",
                        log_obj.get("model_name").and_then(|v| v.as_str()).unwrap_or("unknown"),
                        log_obj.get("prompt_tokens").and_then(|v| v.as_i64()).unwrap_or(0),
                        log_obj.get("completion_tokens").and_then(|v| v.as_i64()).unwrap_or(0),
                        log_obj.get("quota").and_then(|v| v.as_i64()).unwrap_or(0)
                    ),
                    user_id: log_obj.get("user_id")
                        .and_then(|v| v.as_i64())
                        .map(|id| id.to_string()),
                    request_id: log_obj.get("id")
                        .and_then(|v| v.as_i64())
                        .map(|id| id.to_string()),
                    // Additional fields from NewAPI
                    model_name: log_obj.get("model_name")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    prompt_tokens: log_obj.get("prompt_tokens").and_then(|v| v.as_i64()),
                    completion_tokens: log_obj.get("completion_tokens").and_then(|v| v.as_i64()),
                    quota: log_obj.get("quota").and_then(|v| v.as_i64()),
                    token_name: log_obj.get("token_name")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    use_time: log_obj.get("use_time").and_then(|v| v.as_i64()),
                    is_stream: log_obj.get("is_stream").and_then(|v| v.as_bool()),
                    channel: log_obj.get("channel").and_then(|v| v.as_i64()),
                    group: log_obj.get("group")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    metadata: Some({
                        let mut map = HashMap::new();
                        map.insert("raw".to_string(), log.clone());
                        map.insert("other".to_string(), other_data);
                        map
                    }),
                }
            }).collect();

            Ok(LogPaginationResponse {
                items,
                page,
                page_size,
                total: log_data.get("total").and_then(|v| v.as_i64()).unwrap_or(0),
            })
        } else {
            Err(anyhow!("Failed to get logs: {}", response.status()))
        }
    }

    async fn test_connection(&self, station: &RelayStation) -> Result<ConnectionTestResult> {
        let start_time = std::time::Instant::now();
        let client = reqwest::Client::new();
        let user_id = station.user_id.as_deref().unwrap_or("1");
        
        match client
            .get(&format!("{}/api/status", station.api_url))
            .header("New-API-User", user_id)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
        {
            Ok(response) => {
                let response_time = start_time.elapsed().as_millis() as u64;
                let status_code = response.status().as_u16();
                
                if response.status().is_success() {
                    Ok(ConnectionTestResult {
                        success: true,
                        response_time: Some(response_time),
                        message: "Connection successful".to_string(),
                        status_code: Some(status_code),
                        details: None,
                    })
                } else {
                    Ok(ConnectionTestResult {
                        success: false,
                        response_time: Some(response_time),
                        message: format!("HTTP {}", status_code),
                        status_code: Some(status_code),
                        details: None,
                    })
                }
            }
            Err(e) => {
                Ok(ConnectionTestResult {
                    success: false,
                    response_time: None,
                    message: format!("Connection failed: {}", e),
                    status_code: None,
                    details: None,
                })
            }
        }
    }

    async fn list_tokens(&self, station: &RelayStation, page: Option<usize>, size: Option<usize>) -> Result<Vec<RelayStationToken>> {
        let client = reqwest::Client::new();
        let user_id = station.user_id.as_deref().unwrap_or("1");
        let page = page.unwrap_or(1);
        let size = size.unwrap_or(10);
        
        let url = format!("{}/api/token/?p={}&size={}", station.api_url, page, size);
        
        let response = client
            .get(&url)
            .header("Authorization", &format!("Bearer {}", station.system_token))
            .header("New-API-User", user_id)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            let token_data = data["data"].as_object().ok_or_else(|| anyhow!("Invalid response format"))?;
            let empty_vec = vec![];
            let tokens = token_data.get("items").and_then(|v| v.as_array()).unwrap_or(&empty_vec);
            
            Ok(tokens.iter().map(|token| {
                let empty_map = serde_json::Map::new();
                let token_obj = token.as_object().unwrap_or(&empty_map);
                RelayStationToken {
                    id: token_obj.get("id")
                        .and_then(|v| v.as_i64())
                        .map(|id| id.to_string())
                        .unwrap_or_default(),
                    station_id: station.id.clone(),
                    name: token_obj.get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    token: token_obj.get("key")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    user_id: token_obj.get("user_id")
                        .and_then(|v| v.as_i64())
                        .map(|id| id.to_string()),
                    enabled: token_obj.get("status")
                        .and_then(|v| v.as_i64())
                        .map(|s| s == 1)
                        .unwrap_or(false),
                    expires_at: token_obj.get("expired_time")
                        .and_then(|v| v.as_i64())
                        .filter(|&t| t != -1),
                    metadata: Some({
                        let mut map = HashMap::new();
                        map.insert("raw".to_string(), token.clone());
                        map.insert("used_quota".to_string(), 
                            token_obj.get("used_quota").cloned().unwrap_or(serde_json::Value::Null));
                        map.insert("remain_quota".to_string(), 
                            token_obj.get("remain_quota").cloned().unwrap_or(serde_json::Value::Null));
                        map.insert("group".to_string(), 
                            token_obj.get("group").cloned().unwrap_or(serde_json::Value::Null));
                        map
                    }),
                    created_at: token_obj.get("created_time")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0),
                }
            }).collect())
        } else {
            Err(anyhow!("Failed to list tokens: {}", response.status()))
        }
    }

    async fn create_token(&self, station: &RelayStation, token_data: &CreateTokenRequest) -> Result<RelayStationToken> {
        let client = reqwest::Client::new();
        let user_id = station.user_id.as_deref().unwrap_or("1");
        
        let request_body = serde_json::json!({
            "name": token_data.name,
            "remain_quota": token_data.remain_quota.unwrap_or(500000),
            "expired_time": token_data.expired_time.unwrap_or(-1),
            "unlimited_quota": token_data.unlimited_quota.unwrap_or(true),
            "model_limits_enabled": token_data.model_limits_enabled.unwrap_or(false),
            "model_limits": token_data.model_limits.as_deref().unwrap_or(""),
            "group": token_data.group.as_deref().unwrap_or("Claude Code专用"),
            "allow_ips": token_data.allow_ips.as_deref().unwrap_or("")
        });

        let response = client
            .post(&format!("{}/api/token/", station.api_url))
            .header("Authorization", &format!("Bearer {}", station.system_token))
            .header("New-API-User", user_id)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            if let Some(token_obj) = data["data"].as_object() {
                Ok(RelayStationToken {
                    id: token_obj.get("id")
                        .and_then(|v| v.as_i64())
                        .map(|id| id.to_string())
                        .unwrap_or_default(),
                    station_id: station.id.clone(),
                    name: token_obj.get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    token: token_obj.get("key")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    user_id: token_obj.get("user_id")
                        .and_then(|v| v.as_i64())
                        .map(|id| id.to_string()),
                    enabled: token_obj.get("status")
                        .and_then(|v| v.as_i64())
                        .map(|s| s == 1)
                        .unwrap_or(false),
                    expires_at: token_obj.get("expired_time")
                        .and_then(|v| v.as_i64())
                        .filter(|&t| t != -1),
                    metadata: Some({
                        let mut map = HashMap::new();
                        map.insert("raw".to_string(), data["data"].clone());
                        map
                    }),
                    created_at: token_obj.get("created_time")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(chrono::Utc::now().timestamp()),
                })
            } else {
                Err(anyhow!("Invalid response format"))
            }
        } else {
            Err(anyhow!("Failed to create token: {}", response.status()))
        }
    }

    async fn update_token(&self, station: &RelayStation, token_id: &str, token_data: &UpdateTokenRequest) -> Result<RelayStationToken> {
        let client = reqwest::Client::new();
        let user_id = station.user_id.as_deref().unwrap_or("1");
        
        let mut request_body = serde_json::Map::new();
        request_body.insert("id".to_string(), serde_json::Value::Number(token_data.id.into()));
        
        if let Some(name) = &token_data.name {
            request_body.insert("name".to_string(), serde_json::Value::String(name.clone()));
        }
        if let Some(quota) = token_data.remain_quota {
            request_body.insert("remain_quota".to_string(), serde_json::Value::Number(quota.into()));
        }
        if let Some(expired) = token_data.expired_time {
            request_body.insert("expired_time".to_string(), serde_json::Value::Number(expired.into()));
        }
        if let Some(unlimited) = token_data.unlimited_quota {
            request_body.insert("unlimited_quota".to_string(), serde_json::Value::Bool(unlimited));
        }
        if let Some(enabled) = token_data.model_limits_enabled {
            request_body.insert("model_limits_enabled".to_string(), serde_json::Value::Bool(enabled));
        }
        if let Some(limits) = &token_data.model_limits {
            request_body.insert("model_limits".to_string(), serde_json::Value::String(limits.clone()));
        }
        if let Some(group) = &token_data.group {
            request_body.insert("group".to_string(), serde_json::Value::String(group.clone()));
        }
        if let Some(ips) = &token_data.allow_ips {
            request_body.insert("allow_ips".to_string(), serde_json::Value::String(ips.clone()));
        }

        let response = client
            .put(&format!("{}/api/token/", station.api_url))
            .header("Authorization", &format!("Bearer {}", station.system_token))
            .header("New-API-User", user_id)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            if let Some(token_obj) = data["data"].as_object() {
                Ok(RelayStationToken {
                    id: token_obj.get("id")
                        .and_then(|v| v.as_i64())
                        .map(|id| id.to_string())
                        .unwrap_or(token_id.to_string()),
                    station_id: station.id.clone(),
                    name: token_obj.get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    token: token_obj.get("key")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    user_id: token_obj.get("user_id")
                        .and_then(|v| v.as_i64())
                        .map(|id| id.to_string()),
                    enabled: token_obj.get("status")
                        .and_then(|v| v.as_i64())
                        .map(|s| s == 1)
                        .unwrap_or(false),
                    expires_at: token_obj.get("expired_time")
                        .and_then(|v| v.as_i64())
                        .filter(|&t| t != -1),
                    metadata: Some({
                        let mut map = HashMap::new();
                        map.insert("raw".to_string(), data["data"].clone());
                        map
                    }),
                    created_at: token_obj.get("created_time")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0),
                })
            } else {
                Err(anyhow!("Invalid response format"))
            }
        } else {
            Err(anyhow!("Failed to update token: {}", response.status()))
        }
    }

    async fn delete_token(&self, station: &RelayStation, token_id: &str) -> Result<()> {
        let client = reqwest::Client::new();
        let user_id = station.user_id.as_deref().unwrap_or("1");
        
        let response = client
            .delete(&format!("{}/api/token/{}", station.api_url, token_id))
            .header("Authorization", &format!("Bearer {}", station.system_token))
            .header("New-API-User", user_id)
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(anyhow!("Failed to delete token: {}", response.status()))
        }
    }
}

/// Factory to create adapters based on station type
pub fn create_adapter(adapter_type: &RelayStationAdapter) -> NewApiAdapter {
    match adapter_type {
        RelayStationAdapter::Newapi => NewApiAdapter,
        RelayStationAdapter::Oneapi => NewApiAdapter, // OneAPI is compatible with NewAPI
        RelayStationAdapter::Custom => NewApiAdapter, // Default to NewAPI for custom
    }
}

/// Database manager for relay stations
pub struct RelayStationManager {
    db: Arc<Mutex<Connection>>,
}

use std::sync::Arc;

impl RelayStationManager {
    pub fn new(db: Arc<Mutex<Connection>>) -> Result<Self> {
        let manager = Self { db };
        manager.init_tables()?;
        Ok(manager)
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.db.lock().unwrap();
        
        // Create relay_stations table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS relay_stations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                api_url TEXT NOT NULL,
                adapter TEXT NOT NULL,
                auth_method TEXT NOT NULL,
                system_token TEXT NOT NULL,
                user_id TEXT,
                adapter_config TEXT,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;

        // Add user_id column if it doesn't exist (for existing databases)
        let _ = conn.execute(
            "ALTER TABLE relay_stations ADD COLUMN user_id TEXT",
            [],
        );

        // Create relay_station_tokens table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS relay_station_tokens (
                id TEXT PRIMARY KEY,
                station_id TEXT NOT NULL,
                name TEXT NOT NULL,
                token TEXT NOT NULL,
                user_id TEXT,
                enabled INTEGER NOT NULL DEFAULT 1,
                expires_at INTEGER,
                metadata TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (station_id) REFERENCES relay_stations (id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_station_tokens_station_id ON relay_station_tokens(station_id)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_station_tokens_enabled ON relay_station_tokens(enabled)", [])?;

        Ok(())
    }

    pub fn list_stations(&self) -> Result<Vec<RelayStation>> {
        let conn = self.db.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM relay_stations ORDER BY created_at DESC")?;
        
        let station_iter = stmt.query_map([], |row| {
            let adapter_config_str: Option<String> = row.get("adapter_config")?;
            let adapter_config = if let Some(config_str) = adapter_config_str {
                serde_json::from_str(&config_str).ok()
            } else {
                None
            };

            Ok(RelayStation {
                id: row.get("id")?,
                name: row.get("name")?,
                description: row.get("description")?,
                api_url: row.get("api_url")?,
                adapter: match row.get::<_, String>("adapter")?.as_str() {
                    "newapi" => RelayStationAdapter::Newapi,
                    "oneapi" => RelayStationAdapter::Oneapi,
                    "custom" => RelayStationAdapter::Custom,
                    _ => RelayStationAdapter::Newapi,
                },
                auth_method: match row.get::<_, String>("auth_method")?.as_str() {
                    "bearer_token" => AuthMethod::BearerToken,
                    "api_key" => AuthMethod::ApiKey,
                    "custom" => AuthMethod::Custom,
                    _ => AuthMethod::BearerToken,
                },
                system_token: row.get("system_token")?,
                user_id: row.get("user_id")?,
                adapter_config,
                enabled: row.get::<_, i32>("enabled")? != 0,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        })?;

        station_iter.collect::<Result<Vec<_>, _>>().map_err(|e| anyhow!("Database error: {}", e))
    }

    pub fn add_station(&self, station: &RelayStation) -> Result<()> {
        let conn = self.db.lock().unwrap();
        
        let adapter_config_str = if let Some(config) = &station.adapter_config {
            Some(serde_json::to_string(config)?)
        } else {
            None
        };

        conn.execute(
            "INSERT INTO relay_stations (id, name, description, api_url, adapter, auth_method, system_token, user_id, adapter_config, enabled, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                station.id,
                station.name,
                station.description,
                station.api_url,
                match station.adapter {
                    RelayStationAdapter::Newapi => "newapi",
                    RelayStationAdapter::Oneapi => "oneapi",
                    RelayStationAdapter::Custom => "custom",
                },
                match station.auth_method {
                    AuthMethod::BearerToken => "bearer_token",
                    AuthMethod::ApiKey => "api_key",
                    AuthMethod::Custom => "custom",
                },
                station.system_token,
                station.user_id,
                adapter_config_str,
                if station.enabled { 1 } else { 0 },
                station.created_at,
                station.updated_at,
            ],
        )?;

        Ok(())
    }

    pub fn get_station(&self, station_id: &str) -> Result<Option<RelayStation>> {
        let conn = self.db.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM relay_stations WHERE id = ?1")?;
        
        let mut station_iter = stmt.query_map([station_id], |row| {
            let adapter_config_str: Option<String> = row.get("adapter_config")?;
            let adapter_config = if let Some(config_str) = adapter_config_str {
                serde_json::from_str(&config_str).ok()
            } else {
                None
            };

            Ok(RelayStation {
                id: row.get("id")?,
                name: row.get("name")?,
                description: row.get("description")?,
                api_url: row.get("api_url")?,
                adapter: match row.get::<_, String>("adapter")?.as_str() {
                    "newapi" => RelayStationAdapter::Newapi,
                    "oneapi" => RelayStationAdapter::Oneapi,
                    "custom" => RelayStationAdapter::Custom,
                    _ => RelayStationAdapter::Newapi,
                },
                auth_method: match row.get::<_, String>("auth_method")?.as_str() {
                    "bearer_token" => AuthMethod::BearerToken,
                    "api_key" => AuthMethod::ApiKey,
                    "custom" => AuthMethod::Custom,
                    _ => AuthMethod::BearerToken,
                },
                system_token: row.get("system_token")?,
                user_id: row.get("user_id")?,
                adapter_config,
                enabled: row.get::<_, i32>("enabled")? != 0,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        })?;

        match station_iter.next() {
            Some(station) => Ok(Some(station?)),
            None => Ok(None),
        }
    }

    pub fn update_station(&self, station_id: &str, updates: &HashMap<String, serde_json::Value>) -> Result<()> {
        let conn = self.db.lock().unwrap();
        
        let mut query_parts = Vec::new();

        for (key, _) in updates {
            match key.as_str() {
                "name" => query_parts.push("name = ?"),
                "description" => query_parts.push("description = ?"),
                "api_url" => query_parts.push("api_url = ?"),
                "system_token" => query_parts.push("system_token = ?"),
                "user_id" => query_parts.push("user_id = ?"),
                "enabled" => query_parts.push("enabled = ?"),
                _ => {}
            }
        }

        if !query_parts.is_empty() {
            query_parts.push("updated_at = ?");
            let timestamp = Utc::now().timestamp();

            let query = format!("UPDATE relay_stations SET {} WHERE id = ?", query_parts.join(", "));
            
            // Build parameters dynamically
            let mut params_vec: Vec<rusqlite::types::Value> = Vec::new();
            for (key, value) in updates {
                match key.as_str() {
                    "name" => {
                        params_vec.push(rusqlite::types::Value::Text(value.as_str().unwrap_or("").to_string()));
                    }
                    "description" => {
                        if let Some(desc) = value.as_str() {
                            params_vec.push(rusqlite::types::Value::Text(desc.to_string()));
                        } else {
                            params_vec.push(rusqlite::types::Value::Null);
                        }
                    }
                    "api_url" => {
                        params_vec.push(rusqlite::types::Value::Text(value.as_str().unwrap_or("").to_string()));
                    }
                    "system_token" => {
                        params_vec.push(rusqlite::types::Value::Text(value.as_str().unwrap_or("").to_string()));
                    }
                    "user_id" => {
                        if let Some(user_id) = value.as_str() {
                            params_vec.push(rusqlite::types::Value::Text(user_id.to_string()));
                        } else {
                            params_vec.push(rusqlite::types::Value::Null);
                        }
                    }
                    "enabled" => {
                        let enabled_val = if value.as_bool().unwrap_or(false) { 1i64 } else { 0i64 };
                        params_vec.push(rusqlite::types::Value::Integer(enabled_val));
                    }
                    _ => {}
                }
            }
            params_vec.push(rusqlite::types::Value::Integer(timestamp));
            params_vec.push(rusqlite::types::Value::Text(station_id.to_string()));

            conn.execute(&query, rusqlite::params_from_iter(params_vec))?;
        }

        Ok(())
    }

    pub fn delete_station(&self, station_id: &str) -> Result<()> {
        let conn = self.db.lock().unwrap();
        conn.execute("DELETE FROM relay_stations WHERE id = ?1", [station_id])?;
        Ok(())
    }

    pub fn list_tokens(&self, station_id: &str) -> Result<Vec<RelayStationToken>> {
        let conn = self.db.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM relay_station_tokens WHERE station_id = ?1 ORDER BY created_at DESC")?;
        
        let token_iter = stmt.query_map([station_id], |row| {
            let metadata_str: Option<String> = row.get("metadata")?;
            let metadata = if let Some(meta_str) = metadata_str {
                serde_json::from_str(&meta_str).ok()
            } else {
                None
            };

            Ok(RelayStationToken {
                id: row.get("id")?,
                station_id: row.get("station_id")?,
                name: row.get("name")?,
                token: row.get("token")?,
                user_id: row.get("user_id")?,
                enabled: row.get::<_, i32>("enabled")? != 0,
                expires_at: row.get("expires_at")?,
                metadata,
                created_at: row.get("created_at")?,
            })
        })?;

        token_iter.collect::<Result<Vec<_>, _>>().map_err(|e| anyhow!("Database error: {}", e))
    }

    pub fn add_token(&self, token: &RelayStationToken) -> Result<()> {
        let conn = self.db.lock().unwrap();
        
        let metadata_str = if let Some(metadata) = &token.metadata {
            Some(serde_json::to_string(metadata)?)
        } else {
            None
        };

        conn.execute(
            "INSERT INTO relay_station_tokens (id, station_id, name, token, user_id, enabled, expires_at, metadata, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                token.id,
                token.station_id,
                token.name,
                token.token,
                token.user_id,
                if token.enabled { 1 } else { 0 },
                token.expires_at,
                metadata_str,
                token.created_at,
            ],
        )?;

        Ok(())
    }

    pub fn update_token(&self, token_id: &str, updates: &HashMap<String, serde_json::Value>) -> Result<()> {
        let conn = self.db.lock().unwrap();
        
        let mut query_parts = Vec::new();

        for (key, _) in updates {
            match key.as_str() {
                "name" => query_parts.push("name = ?"),
                "token" => query_parts.push("token = ?"),
                "user_id" => query_parts.push("user_id = ?"),
                "enabled" => query_parts.push("enabled = ?"),
                _ => {}
            }
        }

        if !query_parts.is_empty() {
            let query = format!("UPDATE relay_station_tokens SET {} WHERE id = ?", query_parts.join(", "));
            
            let mut params_vec: Vec<rusqlite::types::Value> = Vec::new();
            for (key, value) in updates {
                match key.as_str() {
                    "name" => {
                        params_vec.push(rusqlite::types::Value::Text(value.as_str().unwrap_or("").to_string()));
                    }
                    "token" => {
                        params_vec.push(rusqlite::types::Value::Text(value.as_str().unwrap_or("").to_string()));
                    }
                    "user_id" => {
                        if let Some(user_id) = value.as_str() {
                            params_vec.push(rusqlite::types::Value::Text(user_id.to_string()));
                        } else {
                            params_vec.push(rusqlite::types::Value::Null);
                        }
                    }
                    "enabled" => {
                        let enabled_val = if value.as_bool().unwrap_or(false) { 1i64 } else { 0i64 };
                        params_vec.push(rusqlite::types::Value::Integer(enabled_val));
                    }
                    _ => {}
                }
            }
            params_vec.push(rusqlite::types::Value::Text(token_id.to_string()));

            conn.execute(&query, rusqlite::params_from_iter(params_vec))?;
        }

        Ok(())
    }

    pub fn delete_token(&self, token_id: &str) -> Result<()> {
        let conn = self.db.lock().unwrap();
        conn.execute("DELETE FROM relay_station_tokens WHERE id = ?1", [token_id])?;
        Ok(())
    }
}

// Tauri command handlers

#[tauri::command]
pub async fn list_relay_stations(app: AppHandle) -> Result<Vec<RelayStation>, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(manager) = manager_lock.as_ref() {
        manager.list_stations().map_err(|e| format!("Failed to list stations: {}", e))
    } else {
        Ok(Vec::new()) // Return empty list if manager not initialized
    }
}

#[tauri::command]
pub async fn get_relay_station(station_id: String, app: AppHandle) -> Result<Option<RelayStation>, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(manager) = manager_lock.as_ref() {
        manager.get_station(&station_id).map_err(|e| format!("Failed to get station: {}", e))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn add_relay_station(
    station_request: CreateRelayStationRequest,
    app: AppHandle,
) -> Result<String, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(manager) = manager_lock.as_ref() {
        let station = RelayStation {
            id: Uuid::new_v4().to_string(),
            name: station_request.name,
            description: station_request.description,
            api_url: station_request.api_url,
            adapter: station_request.adapter,
            auth_method: station_request.auth_method,
            system_token: station_request.system_token,
            user_id: station_request.user_id,
            adapter_config: station_request.adapter_config,
            enabled: station_request.enabled,
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
        };
        
        manager.add_station(&station).map_err(|e| format!("Failed to add station: {}", e))?;
        Ok("Station added successfully".to_string())
    } else {
        Err("Relay station manager not initialized".to_string())
    }
}

#[tauri::command]
pub async fn update_relay_station(
    station_id: String,
    updates: HashMap<String, serde_json::Value>,
    app: AppHandle,
) -> Result<String, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(manager) = manager_lock.as_ref() {
        manager.update_station(&station_id, &updates).map_err(|e| format!("Failed to update station: {}", e))?;
        Ok("Station updated successfully".to_string())
    } else {
        Err("Relay station manager not initialized".to_string())
    }
}

#[tauri::command]
pub async fn delete_relay_station(station_id: String, app: AppHandle) -> Result<String, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(manager) = manager_lock.as_ref() {
        manager.delete_station(&station_id).map_err(|e| format!("Failed to delete station: {}", e))?;
        Ok("Station deleted successfully".to_string())
    } else {
        Err("Relay station manager not initialized".to_string())
    }
}

#[tauri::command]
pub async fn get_station_info(station_id: String, app: AppHandle) -> Result<StationInfo, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    
    // Get the station first, releasing the lock before the async call
    let station = {
        let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(manager) = manager_lock.as_ref() {
            manager.get_station(&station_id).map_err(|e| format!("Failed to get station: {}", e))?
        } else {
            return Err("Relay station manager not initialized".to_string());
        }
    };
    
    if let Some(station) = station {
        let adapter = create_adapter(&station.adapter);
        adapter.get_station_info(&station).await.map_err(|e| format!("Failed to get station info: {}", e))
    } else {
        Err("Station not found".to_string())
    }
}

#[tauri::command]
pub async fn list_station_tokens(station_id: String, page: Option<usize>, size: Option<usize>, app: AppHandle) -> Result<Vec<RelayStationToken>, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    
    // Get the station first, releasing the lock before the async call
    let station = {
        let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(manager) = manager_lock.as_ref() {
            manager.get_station(&station_id).map_err(|e| format!("Failed to get station: {}", e))?
        } else {
            return Ok(Vec::new());
        }
    };
    
    if let Some(station) = station {
        let adapter = create_adapter(&station.adapter);
        adapter.list_tokens(&station, page, size).await.map_err(|e| format!("Failed to list tokens: {}", e))
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub async fn add_station_token(
    station_id: String,
    token_data: CreateTokenRequest,
    app: AppHandle,
) -> Result<RelayStationToken, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    
    // Get the station first, releasing the lock before the async call
    let station = {
        let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(manager) = manager_lock.as_ref() {
            manager.get_station(&station_id).map_err(|e| format!("Failed to get station: {}", e))?
        } else {
            return Err("Relay station manager not initialized".to_string());
        }
    };
    
    if let Some(station) = station {
        let adapter = create_adapter(&station.adapter);
        adapter.create_token(&station, &token_data).await.map_err(|e| format!("Failed to create token: {}", e))
    } else {
        Err("Station not found".to_string())
    }
}

#[tauri::command]
pub async fn update_station_token(
    station_id: String,
    token_id: String,
    token_data: UpdateTokenRequest,
    app: AppHandle,
) -> Result<RelayStationToken, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    
    // Get the station first, releasing the lock before the async call
    let station = {
        let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(manager) = manager_lock.as_ref() {
            manager.get_station(&station_id).map_err(|e| format!("Failed to get station: {}", e))?
        } else {
            return Err("Relay station manager not initialized".to_string());
        }
    };
    
    if let Some(station) = station {
        let adapter = create_adapter(&station.adapter);
        adapter.update_token(&station, &token_id, &token_data).await.map_err(|e| format!("Failed to update token: {}", e))
    } else {
        Err("Station not found".to_string())
    }
}

#[tauri::command]
pub async fn delete_station_token(
    station_id: String,
    token_id: String,
    app: AppHandle,
) -> Result<String, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    
    // Get the station first, releasing the lock before the async call
    let station = {
        let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(manager) = manager_lock.as_ref() {
            manager.get_station(&station_id).map_err(|e| format!("Failed to get station: {}", e))?
        } else {
            return Err("Relay station manager not initialized".to_string());
        }
    };
    
    if let Some(station) = station {
        let adapter = create_adapter(&station.adapter);
        adapter.delete_token(&station, &token_id).await.map_err(|e| format!("Failed to delete token: {}", e))?;
        Ok("Token deleted successfully".to_string())
    } else {
        Err("Station not found".to_string())
    }
}

#[tauri::command]
pub async fn get_token_user_info(
    station_id: String,
    user_id: String,
    app: AppHandle,
) -> Result<UserInfo, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    
    // Get station data first, releasing the lock before async call
    let station = {
        let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(manager) = manager_lock.as_ref() {
            manager.get_station(&station_id).map_err(|e| format!("Failed to get station: {}", e))?
        } else {
            return Err("Relay station manager not initialized".to_string());
        }
    };
    
    if let Some(station) = station {
        let adapter = create_adapter(&station.adapter);
        // Use the provided user_id directly (from station configuration)
        adapter.get_user_info(&station, &user_id).await.map_err(|e| format!("Failed to get user info: {}", e))
    } else {
        Err("Station not found".to_string())
    }
}

#[tauri::command]
pub async fn get_station_logs(
    station_id: String,
    page: Option<usize>,
    page_size: Option<usize>,
    app: AppHandle,
) -> Result<LogPaginationResponse, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    
    // Get the station first, releasing the lock before the async call
    let station = {
        let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(manager) = manager_lock.as_ref() {
            manager.get_station(&station_id).map_err(|e| format!("Failed to get station: {}", e))?
        } else {
            return Err("Relay station manager not initialized".to_string());
        }
    };
    
    if let Some(station) = station {
        let adapter = create_adapter(&station.adapter);
        adapter.get_logs(&station, page, page_size).await.map_err(|e| format!("Failed to get logs: {}", e))
    } else {
        Err("Station not found".to_string())
    }
}

#[tauri::command]
pub async fn test_station_connection(station_id: String, app: AppHandle) -> Result<ConnectionTestResult, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    
    // Get the station first, releasing the lock before the async call
    let station = {
        let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(manager) = manager_lock.as_ref() {
            manager.get_station(&station_id).map_err(|e| format!("Failed to get station: {}", e))?
        } else {
            return Err("Relay station manager not initialized".to_string());
        }
    };
    
    if let Some(station) = station {
        let adapter = create_adapter(&station.adapter);
        adapter.test_connection(&station).await.map_err(|e| format!("Failed to test connection: {}", e))
    } else {
        Err("Station not found".to_string())
    }
}