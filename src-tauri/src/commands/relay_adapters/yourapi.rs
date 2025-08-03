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

use super::newapi::NewApiAdapter;

/// YourAPI adapter implementation - inherits most functionality from NewAPI but overrides token listing
pub struct YourApiAdapter {
    newapi: NewApiAdapter,
}

impl YourApiAdapter {
    pub fn new() -> Self {
        Self {
            newapi: NewApiAdapter,
        }
    }
}

#[async_trait::async_trait]
impl StationAdapter for YourApiAdapter {
    // Delegate all methods to NewAPI except list_tokens
    async fn get_station_info(&self, station: &RelayStation) -> Result<StationInfo> {
        self.newapi.get_station_info(station).await
    }

    async fn get_user_info(&self, station: &RelayStation, user_id: &str) -> Result<UserInfo> {
        self.newapi.get_user_info(station, user_id).await
    }

    async fn get_logs(&self, station: &RelayStation, page: Option<usize>, page_size: Option<usize>, filters: Option<serde_json::Value>) -> Result<LogPaginationResponse> {
        self.newapi.get_logs(station, page, page_size, filters).await
    }

    async fn test_connection(&self, station: &RelayStation) -> Result<ConnectionTestResult> {
        self.newapi.test_connection(station).await
    }

    async fn create_token(&self, station: &RelayStation, token_data: &CreateTokenRequest) -> Result<RelayStationToken> {
        self.newapi.create_token(station, token_data).await
    }

    async fn update_token(&self, station: &RelayStation, token_id: &str, token_data: &UpdateTokenRequest) -> Result<RelayStationToken> {
        self.newapi.update_token(station, token_id, token_data).await
    }

    async fn delete_token(&self, station: &RelayStation, token_id: &str) -> Result<()> {
        self.newapi.delete_token(station, token_id).await
    }

    async fn toggle_token(&self, station: &RelayStation, token_id: &str, enabled: bool) -> Result<RelayStationToken> {
        self.newapi.toggle_token(station, token_id, enabled).await
    }

    async fn get_user_groups(&self, station: &RelayStation) -> Result<serde_json::Value> {
        self.newapi.get_user_groups(station).await
    }

    // Override list_tokens for YourAPI format
    async fn list_tokens(&self, station: &RelayStation, page: Option<usize>, size: Option<usize>) -> Result<TokenPaginationResponse> {
        let client = reqwest::Client::new();
        let user_id = station.user_id.as_deref().unwrap_or("1");
        let page = page.unwrap_or(1); // Use 1-based pagination like frontend expects
        let size = size.unwrap_or(10);
        
        // YourAPI might use different pagination parameters
        // Try to get more data to estimate if there are more pages
        let fetch_size = size + 1; // Get one extra item to check if there are more pages
        let url = format!("{}/api/token/?p={}&size={}", station.api_url, page - 1, fetch_size); // Convert to 0-based for API
        
        let response = client
            .get(&url)
            .header("Authorization", &format!("Bearer {}", station.system_token))
            .header("New-API-User", user_id)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            
            // YourAPI returns data as direct array, not nested in pagination object
            let tokens = data["data"].as_array().ok_or_else(|| anyhow!("Invalid response format: data is not an array"))?;
            
            // Check if we have more items than requested (indicates more pages)
            let has_more_pages = tokens.len() > size;
            let tokens_to_show = if has_more_pages {
                &tokens[..size] // Take only the requested number of items
            } else {
                tokens
            };
            
            let items = tokens_to_show.iter().map(|token| {
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
                        map.insert("accessed_time".to_string(),
                            token_obj.get("accessed_time").cloned().unwrap_or(serde_json::Value::Null));
                        map
                    }),
                    created_at: token_obj.get("created_time")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0),
                }
            }).collect::<Vec<_>>();

            let items_len = items.len();
            // Estimate total count: if we're on page 1 and don't have more pages, total = current count
            // If we have more pages, estimate based on current page * page_size + some buffer
            let estimated_total = if page == 1 && !has_more_pages {
                items_len as i64
            } else if has_more_pages {
                // Conservative estimate: at least current page * page_size + 1
                (page * size + 1) as i64
            } else {
                // We're on a later page with no more data, estimate based on what we know
                ((page - 1) * size + items_len) as i64
            };
            
            Ok(TokenPaginationResponse {
                items,
                page,
                page_size: size,
                total: estimated_total,
            })
        } else {
            Err(anyhow!("Failed to list tokens: {}", response.status()))
        }
    }
}