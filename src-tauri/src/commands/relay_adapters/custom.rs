use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::{Result, anyhow};

use crate::commands::relay_stations::{
    RelayStation, RelayStationToken, StationInfo, UserInfo, StationLogEntry, 
    LogPaginationResponse, TokenPaginationResponse, ConnectionTestResult, CreateTokenRequest, UpdateTokenRequest,
    StationAdapter
};

/// Custom adapter implementation - minimal functionality for simple provider configurations
/// This adapter doesn't make API calls and is used for basic URL+key configurations
pub struct CustomAdapter;

#[async_trait::async_trait]
impl StationAdapter for CustomAdapter {
    async fn get_station_info(&self, station: &RelayStation) -> Result<StationInfo> {
        // Return minimal station info without making API calls
        Ok(StationInfo {
            name: station.name.clone(),
            announcement: None,
            api_url: station.api_url.clone(),
            version: Some("Custom".to_string()),
            metadata: Some({
                let mut map = HashMap::new();
                map.insert("adapter_type".to_string(), serde_json::Value::String("custom".to_string()));
                map.insert("note".to_string(), serde_json::Value::String("This is a custom configuration that only provides URL and API key.".to_string()));
                map
            }),
            quota_per_unit: None,
        })
    }

    async fn get_user_info(&self, _station: &RelayStation, _user_id: &str) -> Result<UserInfo> {
        Err(anyhow!("User info not available for custom configurations"))
    }

    async fn get_logs(&self, _station: &RelayStation, _page: Option<usize>, _page_size: Option<usize>, _filters: Option<serde_json::Value>) -> Result<LogPaginationResponse> {
        Err(anyhow!("Logs not available for custom configurations"))
    }

    async fn test_connection(&self, _station: &RelayStation) -> Result<ConnectionTestResult> {
        // For custom adapters, we don't test connections
        Ok(ConnectionTestResult {
            success: true,
            response_time: None,
            message: "Custom configuration - connection testing not applicable".to_string(),
            status_code: None,
            details: None,
        })
    }

    async fn list_tokens(&self, _station: &RelayStation, _page: Option<usize>, _size: Option<usize>) -> Result<TokenPaginationResponse> {
        Err(anyhow!("Token management not available for custom configurations"))
    }

    async fn create_token(&self, _station: &RelayStation, _token_data: &CreateTokenRequest) -> Result<RelayStationToken> {
        Err(anyhow!("Token management not available for custom configurations"))
    }

    async fn update_token(&self, _station: &RelayStation, _token_id: &str, _token_data: &UpdateTokenRequest) -> Result<RelayStationToken> {
        Err(anyhow!("Token management not available for custom configurations"))
    }

    async fn delete_token(&self, _station: &RelayStation, _token_id: &str) -> Result<()> {
        Err(anyhow!("Token management not available for custom configurations"))
    }

    async fn toggle_token(&self, _station: &RelayStation, _token_id: &str, _enabled: bool) -> Result<RelayStationToken> {
        Err(anyhow!("Token management not available for custom configurations"))
    }

    async fn get_user_groups(&self, _station: &RelayStation) -> Result<serde_json::Value> {
        Err(anyhow!("User groups not available for custom configurations"))
    }
}