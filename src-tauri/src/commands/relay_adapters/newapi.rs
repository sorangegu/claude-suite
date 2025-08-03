use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::{Result, anyhow};
use reqwest;
use chrono;

use crate::commands::relay_stations::{
    RelayStation, RelayStationToken, StationInfo, UserInfo, StationLogEntry, 
    LogPaginationResponse, TokenPaginationResponse, ConnectionTestResult, CreateTokenRequest, UpdateTokenRequest,
    StationAdapter
};

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

    async fn get_logs(&self, station: &RelayStation, page: Option<usize>, page_size: Option<usize>, filters: Option<serde_json::Value>) -> Result<LogPaginationResponse> {
        let client = reqwest::Client::new();
        let page = page.unwrap_or(1);
        let page_size = page_size.unwrap_or(10);
        let user_id = station.user_id.as_deref().unwrap_or("1");
        
        // Parse filters if provided
        let mut start_timestamp = 0i64;
        let mut end_timestamp = chrono::Utc::now().timestamp();
        let mut model_name = String::new();
        let mut group = String::new();
        
        if let Some(filters_obj) = filters {
            if let Some(start_time) = filters_obj.get("startTime").and_then(|v| v.as_str()) {
                if !start_time.is_empty() {
                    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&format!("{}:00+00:00", start_time)) {
                        start_timestamp = dt.timestamp();
                    }
                }
            }
            
            if let Some(end_time) = filters_obj.get("endTime").and_then(|v| v.as_str()) {
                if !end_time.is_empty() {
                    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&format!("{}:00+00:00", end_time)) {
                        end_timestamp = dt.timestamp();
                    }
                }
            }
            
            if let Some(model) = filters_obj.get("modelName").and_then(|v| v.as_str()) {
                model_name = model.to_string();
            }
            
            if let Some(g) = filters_obj.get("group").and_then(|v| v.as_str()) {
                group = g.to_string();
            }
        }
        
        let url = format!(
            "{}/api/log/self?p={}&page_size={}&type=0&token_name=&model_name={}&start_timestamp={}&end_timestamp={}&group={}",
            station.api_url,
            page,
            page_size,
            urlencoding::encode(&model_name),
            start_timestamp,
            end_timestamp,
            urlencoding::encode(&group)
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

    async fn list_tokens(&self, station: &RelayStation, page: Option<usize>, size: Option<usize>) -> Result<TokenPaginationResponse> {
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
            
            let items = tokens.iter().map(|token| {
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
                    group: token_obj.get("group")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    remain_quota: token_obj.get("remain_quota")
                        .and_then(|v| v.as_i64()),
                    unlimited_quota: token_obj.get("unlimited_quota")
                        .and_then(|v| v.as_bool()),
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
            }).collect();

            Ok(TokenPaginationResponse {
                items,
                page,
                page_size: size,
                total: token_data.get("total").and_then(|v| v.as_i64()).unwrap_or(0),
            })
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
            
            // Check if creation was successful
            if data.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                // NewAPI create token response doesn't include token data
                // We need to fetch the latest tokens to get the created token
                // For now, return a minimal token object with the name we sent
                Ok(RelayStationToken {
                    id: "".to_string(), // Will be updated when token list is refreshed
                    station_id: station.id.clone(),
                    name: token_data.name.clone(),
                    token: "".to_string(), // Will be updated when token list is refreshed
                    user_id: Some(user_id.to_string()),
                    enabled: true,
                    expires_at: if token_data.expired_time.unwrap_or(-1) == -1 { None } else { token_data.expired_time },
                    group: token_data.group.clone(),
                    remain_quota: token_data.remain_quota,
                    unlimited_quota: token_data.unlimited_quota,
                    metadata: Some({
                        let mut map = HashMap::new();
                        map.insert("response".to_string(), data.clone());
                        map.insert("note".to_string(), serde_json::Value::String("Token created successfully, refresh to see details".to_string()));
                        map
                    }),
                    created_at: chrono::Utc::now().timestamp(),
                })
            } else {
                let message = data.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error");
                Err(anyhow!("Failed to create token: {}", message))
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
        if let Some(enabled) = token_data.enabled {
            request_body.insert("status".to_string(), serde_json::Value::Number((if enabled { 1 } else { 0 }).into()));
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
                    group: token_obj.get("group")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    remain_quota: token_obj.get("remain_quota")
                        .and_then(|v| v.as_i64()),
                    unlimited_quota: token_obj.get("unlimited_quota")
                        .and_then(|v| v.as_bool()),
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

    async fn toggle_token(&self, station: &RelayStation, token_id: &str, enabled: bool) -> Result<RelayStationToken> {
        let client = reqwest::Client::new();
        let user_id = station.user_id.as_deref().unwrap_or("1");
        
        let request_body = serde_json::json!({
            "id": token_id.parse::<i64>().map_err(|e| anyhow!("Invalid token ID: {}", e))?,
            "status": if enabled { 1 } else { 2 }
        });
        
        let response = client
            .put(&format!("{}/api/token/?status_only=true", station.api_url))
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
                        .unwrap_or(enabled),
                    expires_at: token_obj.get("expired_time")
                        .and_then(|v| v.as_i64())
                        .filter(|&t| t != -1),
                    group: token_obj.get("group")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    remain_quota: token_obj.get("remain_quota")
                        .and_then(|v| v.as_i64()),
                    unlimited_quota: token_obj.get("unlimited_quota")
                        .and_then(|v| v.as_bool()),
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
            Err(anyhow!("Failed to toggle token: {}", response.status()))
        }
    }

    async fn get_user_groups(&self, station: &RelayStation) -> Result<serde_json::Value> {
        let client = reqwest::Client::new();
        let user_id = station.user_id.as_deref().unwrap_or("1");
        
        let response = client
            .get(&format!("{}/api/user/self/groups", station.api_url))
            .header("Authorization", &format!("Bearer {}", station.system_token))
            .header("New-API-User", user_id)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            Ok(data)
        } else {
            Err(anyhow!("API request failed with status: {}", response.status()))
        }
    }
}