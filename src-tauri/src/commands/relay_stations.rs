use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, State, Manager};
use chrono::Utc;
use uuid::Uuid;
use anyhow::{Result, anyhow};
use reqwest;
use rusqlite::{params, Connection};
use std::sync::Mutex;

use super::relay_adapters::{NewApiAdapter, YourApiAdapter, CustomAdapter};

/// Relay station adapter type for different station implementations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RelayStationAdapter {
    Newapi,
    Oneapi,
    Yourapi,
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
    pub group: Option<String>,
    pub remain_quota: Option<i64>,
    pub unlimited_quota: Option<bool>,
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

/// Token pagination response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPaginationResponse {
    pub items: Vec<RelayStationToken>,
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
    pub enabled: Option<bool>,
}

/// Adapter trait for different relay station implementations
#[async_trait::async_trait]
pub trait StationAdapter: Send + Sync {
    async fn get_station_info(&self, station: &RelayStation) -> Result<StationInfo>;
    async fn get_user_info(&self, station: &RelayStation, user_id: &str) -> Result<UserInfo>;
    async fn get_logs(&self, station: &RelayStation, page: Option<usize>, page_size: Option<usize>, filters: Option<serde_json::Value>) -> Result<LogPaginationResponse>;
    async fn test_connection(&self, station: &RelayStation) -> Result<ConnectionTestResult>;
    
    // Token management methods
    async fn list_tokens(&self, station: &RelayStation, page: Option<usize>, size: Option<usize>) -> Result<TokenPaginationResponse>;
    async fn create_token(&self, station: &RelayStation, token_data: &CreateTokenRequest) -> Result<RelayStationToken>;
    async fn update_token(&self, station: &RelayStation, token_id: &str, token_data: &UpdateTokenRequest) -> Result<RelayStationToken>;
    async fn delete_token(&self, station: &RelayStation, token_id: &str) -> Result<()>;
    async fn toggle_token(&self, station: &RelayStation, token_id: &str, enabled: bool) -> Result<RelayStationToken>;
    
    // User groups management
    async fn get_user_groups(&self, station: &RelayStation) -> Result<serde_json::Value>;
}


/// Factory to create adapters based on station type
pub fn create_adapter(adapter_type: &RelayStationAdapter) -> Box<dyn StationAdapter> {
    match adapter_type {
        RelayStationAdapter::Newapi => Box::new(NewApiAdapter),
        RelayStationAdapter::Oneapi => Box::new(NewApiAdapter), // OneAPI is compatible with NewAPI
        RelayStationAdapter::Yourapi => Box::new(YourApiAdapter::new()),
        RelayStationAdapter::Custom => Box::new(CustomAdapter), // Custom adapter for simple configurations
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
                    "yourapi" => RelayStationAdapter::Yourapi,
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
                    RelayStationAdapter::Yourapi => "yourapi",
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
                    "yourapi" => RelayStationAdapter::Yourapi,
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
                "adapter" => query_parts.push("adapter = ?"),
                "auth_method" => query_parts.push("auth_method = ?"),
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
                    "adapter" => {
                        params_vec.push(rusqlite::types::Value::Text(value.as_str().unwrap_or("newapi").to_string()));
                    }
                    "auth_method" => {
                        params_vec.push(rusqlite::types::Value::Text(value.as_str().unwrap_or("bearer_token").to_string()));
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

    // pub fn list_tokens(&self, station_id: &str) -> Result<Vec<RelayStationToken>> {
    //     let conn = self.db.lock().unwrap();
    //     let mut stmt = conn.prepare("SELECT * FROM relay_station_tokens WHERE station_id = ?1 ORDER BY created_at DESC")?;
        
    //     let token_iter = stmt.query_map([station_id], |row| {
    //         let metadata_str: Option<String> = row.get("metadata")?;
    //         let metadata = if let Some(meta_str) = metadata_str {
    //             serde_json::from_str(&meta_str).ok()
    //         } else {
    //             None
    //         };

    //         Ok(RelayStationToken {
    //             id: row.get("id")?,
    //             station_id: row.get("station_id")?,
    //             name: row.get("name")?,
    //             token: row.get("token")?,
    //             user_id: row.get("user_id")?,
    //             enabled: row.get::<_, i32>("enabled")? != 0,
    //             expires_at: row.get("expires_at")?,
    //             group: None, // Database doesn't store groups, they come from API
    //             remain_quota: None, // Database doesn't store quotas, they come from API
    //             unlimited_quota: None, // Database doesn't store quota settings, they come from API
    //             metadata,
    //             created_at: row.get("created_at")?,
    //         })
    //     })?;

    //     token_iter.collect::<Result<Vec<_>, _>>().map_err(|e| anyhow!("Database error: {}", e))
    // }

    // pub fn add_token(&self, token: &RelayStationToken) -> Result<()> {
    //     let conn = self.db.lock().unwrap();
        
    //     let metadata_str = if let Some(metadata) = &token.metadata {
    //         Some(serde_json::to_string(metadata)?)
    //     } else {
    //         None
    //     };

    //     conn.execute(
    //         "INSERT INTO relay_station_tokens (id, station_id, name, token, user_id, enabled, expires_at, metadata, created_at)
    //          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    //         params![
    //             token.id,
    //             token.station_id,
    //             token.name,
    //             token.token,
    //             token.user_id,
    //             if token.enabled { 1 } else { 0 },
    //             token.expires_at,
    //             metadata_str,
    //             token.created_at,
    //         ],
    //     )?;

    //     Ok(())
    // }

    // pub fn update_token(&self, token_id: &str, updates: &HashMap<String, serde_json::Value>) -> Result<()> {
    //     let conn = self.db.lock().unwrap();
        
    //     let mut query_parts = Vec::new();

    //     for (key, _) in updates {
    //         match key.as_str() {
    //             "name" => query_parts.push("name = ?"),
    //             "token" => query_parts.push("token = ?"),
    //             "user_id" => query_parts.push("user_id = ?"),
    //             "enabled" => query_parts.push("enabled = ?"),
    //             _ => {}
    //         }
    //     }

    //     if !query_parts.is_empty() {
    //         let query = format!("UPDATE relay_station_tokens SET {} WHERE id = ?", query_parts.join(", "));
            
    //         let mut params_vec: Vec<rusqlite::types::Value> = Vec::new();
    //         for (key, value) in updates {
    //             match key.as_str() {
    //                 "name" => {
    //                     params_vec.push(rusqlite::types::Value::Text(value.as_str().unwrap_or("").to_string()));
    //                 }
    //                 "token" => {
    //                     params_vec.push(rusqlite::types::Value::Text(value.as_str().unwrap_or("").to_string()));
    //                 }
    //                 "user_id" => {
    //                     if let Some(user_id) = value.as_str() {
    //                         params_vec.push(rusqlite::types::Value::Text(user_id.to_string()));
    //                     } else {
    //                         params_vec.push(rusqlite::types::Value::Null);
    //                     }
    //                 }
    //                 "enabled" => {
    //                     let enabled_val = if value.as_bool().unwrap_or(false) { 1i64 } else { 0i64 };
    //                     params_vec.push(rusqlite::types::Value::Integer(enabled_val));
    //                 }
    //                 _ => {}
    //             }
    //         }
    //         params_vec.push(rusqlite::types::Value::Text(token_id.to_string()));

    //         conn.execute(&query, rusqlite::params_from_iter(params_vec))?;
    //     }

    //     Ok(())
    // }

    // pub fn delete_token(&self, token_id: &str) -> Result<()> {
    //     let conn = self.db.lock().unwrap();
    //     conn.execute("DELETE FROM relay_station_tokens WHERE id = ?1", [token_id])?;
    //     Ok(())
    // }
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
pub async fn list_station_tokens(station_id: String, page: Option<usize>, size: Option<usize>, app: AppHandle) -> Result<TokenPaginationResponse, String> {
    let state: State<Mutex<Option<RelayStationManager>>> = app.state();
    
    // Get the station first, releasing the lock before the async call
    let station = {
        let manager_lock = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(manager) = manager_lock.as_ref() {
            manager.get_station(&station_id).map_err(|e| format!("Failed to get station: {}", e))?
        } else {
            return Ok(TokenPaginationResponse {
                items: Vec::new(),
                page: 1,
                page_size: 10,
                total: 0,
            });
        }
    };
    
    if let Some(station) = station {
        let adapter = create_adapter(&station.adapter);
        adapter.list_tokens(&station, page, size).await.map_err(|e| format!("Failed to list tokens: {}", e))
    } else {
        Ok(TokenPaginationResponse {
            items: Vec::new(),
            page: 1,
            page_size: 10,
            total: 0,
        })
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
    filters: Option<serde_json::Value>,
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
        adapter.get_logs(&station, page, page_size, filters).await.map_err(|e| format!("Failed to get logs: {}", e))
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

#[tauri::command]
pub async fn api_user_self_groups(station_id: String, app: AppHandle) -> Result<serde_json::Value, String> {
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
        adapter.get_user_groups(&station).await.map_err(|e| format!("Failed to get user groups: {}", e))
    } else {
        Err("Station not found".to_string())
    }
}

#[tauri::command]
pub async fn toggle_station_token(
    station_id: String,
    token_id: String,
    enabled: bool,
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
        adapter.toggle_token(&station, &token_id, enabled).await.map_err(|e| format!("Failed to toggle token: {}", e))
    } else {
        Err("Station not found".to_string())
    }
}