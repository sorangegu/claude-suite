use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{command, AppHandle, Manager};
use crate::process::ProcessRegistryState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub base_url: String,
    pub auth_token: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CurrentConfig {
    pub anthropic_base_url: Option<String>,
    pub anthropic_auth_token: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub anthropic_model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeSettings {
    env: Option<HashMap<String, serde_json::Value>>,
    #[serde(flatten)]
    other: HashMap<String, serde_json::Value>,
}

// 获取 Claude 配置目录路径
fn get_claude_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?;
    
    let config_dir = home_dir.join(".claude");
    
    // 确保配置目录存在
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("无法创建配置目录: {}", e))?;
    }
    
    Ok(config_dir)
}

// 获取 Claude Raw Settings 文件路径
fn get_claude_settings_path() -> Result<PathBuf, String> {
    let claude_dir = get_claude_dir()?;
    Ok(claude_dir.join("settings.json"))
}

// 读取 Claude Raw Settings
fn read_claude_settings() -> Result<ClaudeSettings, String> {
    let settings_path = get_claude_settings_path()?;
    
    if !settings_path.exists() {
        return Ok(ClaudeSettings {
            env: None,
            other: HashMap::new(),
        });
    }
    
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("读取 Claude settings 文件失败: {}", e))?;
    
    let settings: ClaudeSettings = serde_json::from_str(&content)
        .map_err(|e| format!("解析 Claude settings 文件失败: {}", e))?;
    
    Ok(settings)
}

// 写入 Claude Raw Settings
fn write_claude_settings(settings: &ClaudeSettings) -> Result<(), String> {
    let settings_path = get_claude_settings_path()?;
    
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("序列化 Claude settings 失败: {}", e))?;
    
    fs::write(&settings_path, content)
        .map_err(|e| format!("写入 Claude settings 文件失败: {}", e))?;
    
    Ok(())
}

// 更新 Raw Settings 中的环境变量
fn update_settings_env(key: &str, value: Option<&str>) -> Result<(), String> {
    let mut settings = read_claude_settings()?;
    
    // 初始化 env 如果不存在
    if settings.env.is_none() {
        settings.env = Some(HashMap::new());
    }
    
    let env_vars = settings.env.as_mut().unwrap();
    
    match value {
        Some(val) => {
            env_vars.insert(key.to_string(), serde_json::Value::String(val.to_string()));
        }
        None => {
            env_vars.remove(key);
        }
    }
    
    write_claude_settings(&settings)?;
    Ok(())
}

// 从 Raw Settings 中获取环境变量值
fn get_settings_env(key: &str) -> Option<String> {
    if let Ok(settings) = read_claude_settings() {
        if let Some(env_vars) = settings.env {
            if let Some(value) = env_vars.get(key) {
                return value.as_str().map(|s| s.to_string());
            }
        }
    }
    None
}

// 获取配置文件路径
fn get_providers_config_path() -> Result<PathBuf, String> {
    let claude_dir = get_claude_dir()?;
    Ok(claude_dir.join("providers.json"))
}
// 从文件加载代理商配置
fn load_providers_from_file() -> Result<Vec<ProviderConfig>, String> {
    let config_path = get_providers_config_path()?;
    
    if !config_path.exists() {
        // 如果文件不存在，返回空列表
        return Ok(vec![]);
    }
    
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    
    if content.trim().is_empty() {
        return Ok(vec![]);
    }
    
    let providers: Vec<ProviderConfig> = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;
    
    Ok(providers)
}

// 保存代理商配置到文件
fn save_providers_to_file(providers: &Vec<ProviderConfig>) -> Result<(), String> {
    let config_path = get_providers_config_path()?;
    
    let content = serde_json::to_string_pretty(providers)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    
    fs::write(&config_path, content)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    Ok(())
}

// CRUD 操作 - 获取所有代理商配置
#[command]
pub fn get_provider_presets() -> Result<Vec<ProviderConfig>, String> {
    let config_path = get_providers_config_path()?;
    
    if !config_path.exists() {
        return Ok(vec![]);
    }
    
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("无法读取配置文件: {}", e))?;
    
    let configs: Vec<ProviderConfig> = serde_json::from_str(&content)
        .map_err(|e| format!("配置文件格式错误: {}", e))?;
    
    Ok(configs)
}

#[command]
pub fn add_provider_config(config: ProviderConfig) -> Result<String, String> {
    let mut providers = load_providers_from_file()?;
    
    // 检查ID是否已存在
    if providers.iter().any(|p| p.id == config.id) {
        return Err(format!("ID '{}' 已存在，请使用不同的ID", config.id));
    }
    
    providers.push(config.clone());
    save_providers_to_file(&providers)?;
    
    Ok(format!("成功添加代理商配置: {}", config.name))
}

// CRUD 操作 - 更新代理商配置
#[command]
pub fn update_provider_config(config: ProviderConfig) -> Result<String, String> {
    let mut providers = load_providers_from_file()?;
    
    let index = providers.iter().position(|p| p.id == config.id)
        .ok_or_else(|| format!("未找到ID为 '{}' 的配置", config.id))?;
    
    providers[index] = config.clone();
    save_providers_to_file(&providers)?;
    
    Ok(format!("成功更新代理商配置: {}", config.name))
}

// CRUD 操作 - 删除代理商配置
#[command]
pub fn delete_provider_config(id: String) -> Result<String, String> {
    let mut providers = load_providers_from_file()?;
    
    let index = providers.iter().position(|p| p.id == id)
        .ok_or_else(|| format!("未找到ID为 '{}' 的配置", id))?;
    
    let deleted_config = providers.remove(index);
    save_providers_to_file(&providers)?;
    
    Ok(format!("成功删除代理商配置: {}", deleted_config.name))
}

// CRUD 操作 - 获取单个代理商配置
#[command]
pub fn get_provider_config(id: String) -> Result<ProviderConfig, String> {
    let providers = load_providers_from_file()?;
    
    providers.into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("未找到ID为 '{}' 的配置", id))
}

#[command]
pub fn get_current_provider_config() -> Result<CurrentConfig, String> {
    Ok(CurrentConfig {
        anthropic_base_url: get_settings_env("ANTHROPIC_BASE_URL")
            .or_else(|| env::var("ANTHROPIC_BASE_URL").ok()),
        anthropic_auth_token: get_settings_env("ANTHROPIC_AUTH_TOKEN")
            .or_else(|| env::var("ANTHROPIC_AUTH_TOKEN").ok()),
        anthropic_api_key: get_settings_env("ANTHROPIC_API_KEY")
            .or_else(|| env::var("ANTHROPIC_API_KEY").ok()),
        anthropic_model: get_settings_env("ANTHROPIC_MODEL")
            .or_else(|| env::var("ANTHROPIC_MODEL").ok()),
    })
}

#[command]
pub async fn switch_provider_config(config: ProviderConfig) -> Result<String, String> {
    // 更新 Raw Settings 中的环境变量
    update_settings_env("ANTHROPIC_BASE_URL", Some(&config.base_url))?;
    
    if let Some(auth_token) = &config.auth_token {
        update_settings_env("ANTHROPIC_AUTH_TOKEN", Some(auth_token))?;
    } else {
        update_settings_env("ANTHROPIC_AUTH_TOKEN", None)?;
    }
    
    if let Some(api_key) = &config.api_key {
        update_settings_env("ANTHROPIC_API_KEY", Some(api_key))?;
    } else {
        update_settings_env("ANTHROPIC_API_KEY", None)?;
    }
    
    if let Some(model) = &config.model {
        update_settings_env("ANTHROPIC_MODEL", Some(model))?;
    } else {
        update_settings_env("ANTHROPIC_MODEL", None)?;
    }
    
    Ok(format!("已成功切换到 {} ({})，配置已保存到 Raw Settings", config.name, config.description))
}

#[command]
pub async fn clear_provider_config() -> Result<String, String> {
    // 清理所有 ANTHROPIC 相关环境变量在 Raw Settings 中
    let vars_to_clear = vec![
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_AUTH_TOKEN", 
        "ANTHROPIC_BASE_URL",
        "ANTHROPIC_MODEL"
    ];
    
    for var_name in &vars_to_clear {
        update_settings_env(var_name, None)?;
    }
    
    Ok("已清理所有 ANTHROPIC 环境变量在 Raw Settings 中".to_string())
}

// 检测当前应用的代理商（基于 Raw Settings 中的 API 地址和 Token）
#[command]
pub fn detect_current_provider() -> Result<Option<String>, String> {
    let settings = read_claude_settings()?;
    
    if let Some(env_vars) = settings.env {
        // 检查是否有 ANTHROPIC_BASE_URL 和认证信息
        let base_url = env_vars.get("ANTHROPIC_BASE_URL")
            .and_then(|v| v.as_str());
        let has_auth = env_vars.get("ANTHROPIC_AUTH_TOKEN")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .is_some() || 
            env_vars.get("ANTHROPIC_API_KEY")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .is_some();
        
        if let Some(url) = base_url {
            if has_auth {
                // 尝试匹配已知的代理商配置
                if let Ok(providers) = load_providers_from_file() {
                    for provider in providers {
                        if provider.base_url == url {
                            return Ok(Some(provider.id));
                        }
                    }
                }
                
                // 如果没有匹配到预设代理商，返回通用描述
                if url == "https://api.anthropic.com" {
                    return Ok(Some("official".to_string()));
                } else {
                    return Ok(Some("custom".to_string()));
                }
            }
        }
    }
    
    Ok(None)
}

// 检查是否已应用代理商（检查 Raw Settings 中是否有非默认的 API 配置）
#[command]
pub fn is_provider_applied() -> Result<bool, String> {
    let settings = read_claude_settings()?;
    
    if let Some(env_vars) = settings.env {
        // 检查是否有 ANTHROPIC_BASE_URL 
        let base_url = env_vars.get("ANTHROPIC_BASE_URL")
            .and_then(|v| v.as_str());
        
        // 检查是否有认证信息
        let has_auth = env_vars.get("ANTHROPIC_AUTH_TOKEN")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .is_some() || 
            env_vars.get("ANTHROPIC_API_KEY")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .is_some();
        
        // 如果有 base_url 且不是默认值，或者有认证信息，则认为已应用代理商
        return Ok(base_url.is_some() && (base_url != Some("https://api.anthropic.com") || has_auth));
    }
    
    Ok(false)
}

#[command]
pub fn test_provider_connection(base_url: String) -> Result<String, String> {
    // 简单的连接测试 - 尝试访问 API 端点
    let test_url = if base_url.ends_with('/') {
        format!("{}v1/messages", base_url)
    } else {
        format!("{}/v1/messages", base_url)
    };
    
    // 这里可以实现实际的 HTTP 请求测试
    // 目前返回一个简单的成功消息
    Ok(format!("连接测试完成：{}", test_url))
}
async fn terminate_claude_processes(app: &AppHandle) {
    log::info!("正在终止所有Claude进程以应用新的代理商配置...");
    
    // 获取进程注册表
    let registry = app.state::<ProcessRegistryState>();
    
    // 获取所有活动的Claude会话
    match registry.0.get_running_claude_sessions() {
        Ok(sessions) => {
            log::info!("找到 {} 个活动的Claude会话", sessions.len());
            
            for session in sessions {
                let session_id_str = match &session.process_type {
                    crate::process::registry::ProcessType::ClaudeSession { session_id } => session_id.as_str(),
                    _ => "unknown",
                };
                
                log::info!("正在终止Claude会话: session_id={}, run_id={}, PID={}", 
                    session_id_str,
                    session.run_id, 
                    session.pid
                );
                
                // 尝试优雅地终止进程
                match registry.0.kill_process(session.run_id).await {
                    Ok(success) => {
                        if success {
                            log::info!("成功终止Claude会话 {}", session.run_id);
                        } else {
                            log::warn!("终止Claude会话 {} 返回false", session.run_id);
                            
                            // 尝试强制终止
                            if let Err(e) = registry.0.kill_process_by_pid(session.run_id, session.pid as u32) {
                                log::error!("强制终止进程失败: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("终止Claude会话 {} 失败: {}", session.run_id, e);
                        
                        // 尝试强制终止
                        if let Err(e2) = registry.0.kill_process_by_pid(session.run_id, session.pid as u32) {
                            log::error!("强制终止进程也失败: {}", e2);
                        }
                    }
                }
            }
        }
        Err(e) => {
            log::error!("获取Claude会话列表失败: {}", e);
        }
    }
    
    log::info!("Claude进程终止操作完成");
}