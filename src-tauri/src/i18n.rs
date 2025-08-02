use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Language {
    Zh,
    En,
}

impl Default for Language {
    fn default() -> Self {
        Language::Zh // 默认中文
    }
}

impl Language {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "zh" | "zh-cn" | "chinese" => Language::Zh,
            "en" | "en-us" | "english" => Language::En,
            _ => Language::Zh,
        }
    }
}

pub struct I18n {
    current_language: Language,
    messages: HashMap<String, HashMap<Language, String>>,
}

impl I18n {
    pub fn new(language: Language) -> Self {
        let mut i18n = Self {
            current_language: language,
            messages: HashMap::new(),
        };
        i18n.initialize_messages();
        i18n
    }

    pub fn set_language(&mut self, language: Language) {
        self.current_language = language;
    }

    pub fn get_language(&self) -> &Language {
        &self.current_language
    }

    pub fn t(&self, key: &str) -> String {
        self.messages
            .get(key)
            .and_then(|translations| translations.get(&self.current_language))
            .or_else(|| {
                // 如果当前语言没有翻译，尝试英文
                self.messages
                    .get(key)
                    .and_then(|translations| translations.get(&Language::En))
            })
            .cloned()
            .unwrap_or_else(|| format!("Missing translation: {}", key))
    }

    pub fn t_with_args(&self, key: &str, args: &[(&str, &str)]) -> String {
        let mut message = self.t(key);
        for (placeholder, value) in args {
            message = message.replace(&format!("{{{}}}", placeholder), value);
        }
        message
    }

    fn add_message(&mut self, key: &str, zh: &str, en: &str) {
        let mut translations = HashMap::new();
        translations.insert(Language::Zh, zh.to_string());
        translations.insert(Language::En, en.to_string());
        self.messages.insert(key.to_string(), translations);
    }

    fn initialize_messages(&mut self) {
        // Provider messages
        self.add_message("provider.home_dir_not_found", "无法获取用户主目录", "Failed to get user home directory");
        self.add_message("provider.create_config_dir_failed", "无法创建配置目录: {error}", "Failed to create config directory: {error}");
        self.add_message("provider.read_claude_settings_failed", "读取 Claude settings 文件失败: {error}", "Failed to read Claude settings file: {error}");
        self.add_message("provider.parse_claude_settings_failed", "解析 Claude settings 文件失败: {error}", "Failed to parse Claude settings file: {error}");
        self.add_message("provider.serialize_claude_settings_failed", "序列化 Claude settings 失败: {error}", "Failed to serialize Claude settings: {error}");
        self.add_message("provider.write_claude_settings_failed", "写入 Claude settings 文件失败: {error}", "Failed to write Claude settings file: {error}");
        self.add_message("provider.read_config_failed", "读取配置文件失败: {error}", "Failed to read config file: {error}");
        self.add_message("provider.parse_config_failed", "解析配置文件失败: {error}", "Failed to parse config file: {error}");
        self.add_message("provider.serialize_config_failed", "序列化配置失败: {error}", "Failed to serialize config: {error}");
        self.add_message("provider.write_config_failed", "写入配置文件失败: {error}", "Failed to write config file: {error}");
        self.add_message("provider.invalid_config_format", "配置文件格式错误: {error}", "Invalid config file format: {error}");
        self.add_message("provider.id_already_exists", "ID '{id}' 已存在，请使用不同的ID", "ID '{id}' already exists, please use a different ID");
        self.add_message("provider.add_success", "成功添加代理商配置: {name}", "Successfully added provider config: {name}");
        self.add_message("provider.config_not_found", "未找到ID为 '{id}' 的配置", "Config with ID '{id}' not found");
        self.add_message("provider.update_success", "成功更新代理商配置: {name}", "Successfully updated provider config: {name}");
        self.add_message("provider.delete_success", "成功删除代理商配置: {name}", "Successfully deleted provider config: {name}");
        self.add_message("provider.switch_success", "已成功切换到 {name} ({description})，配置已保存到 Raw Settings", "Successfully switched to {name} ({description}), config saved to Raw Settings");
        self.add_message("provider.clear_success", "已清理所有 ANTHROPIC 环境变量在 Raw Settings 中", "Cleared all ANTHROPIC environment variables in Raw Settings");
        self.add_message("provider.connection_test_complete", "连接测试完成：{url}", "Connection test completed: {url}");
        
        // Process termination messages
        self.add_message("process.terminating_claude_processes", "正在终止所有Claude进程以应用新的代理商配置...", "Terminating all Claude processes to apply new provider configuration...");
        self.add_message("process.found_active_sessions", "找到 {count} 个活动的Claude会话", "Found {count} active Claude sessions");
        self.add_message("process.terminating_session", "正在终止Claude会话: session_id={session_id}, run_id={run_id}, PID={pid}", "Terminating Claude session: session_id={session_id}, run_id={run_id}, PID={pid}");
        self.add_message("process.session_terminated", "成功终止Claude会话 {run_id}", "Successfully terminated Claude session {run_id}");
        self.add_message("process.session_terminate_false", "终止Claude会话 {run_id} 返回false", "Terminating Claude session {run_id} returned false");
        self.add_message("process.force_terminate_failed", "强制终止进程失败: {error}", "Failed to force terminate process: {error}");
        self.add_message("process.session_terminate_failed", "终止Claude会话 {run_id} 失败: {error}", "Failed to terminate Claude session {run_id}: {error}");
        self.add_message("process.force_terminate_also_failed", "强制终止进程也失败: {error}", "Force terminate process also failed: {error}");
        self.add_message("process.get_sessions_failed", "获取Claude会话列表失败: {error}", "Failed to get Claude sessions list: {error}");
        self.add_message("process.termination_complete", "Claude进程终止操作完成", "Claude process termination operation completed");

        // Storage messages
        self.add_message("storage.db_connection_failed", "数据库连接失败: {error}", "Database connection failed: {error}");
        self.add_message("storage.query_execution_failed", "查询执行失败: {error}", "Query execution failed: {error}");
        self.add_message("storage.table_not_found", "表 '{table}' 不存在", "Table '{table}' does not exist");
        self.add_message("storage.invalid_sql_query", "无效的SQL查询", "Invalid SQL query");
        
        // MCP messages
        self.add_message("mcp.server_not_found", "服务器 '{name}' 未找到", "Server '{name}' not found");
        self.add_message("mcp.server_start_failed", "启动MCP服务器失败: {error}", "Failed to start MCP server: {error}");
        self.add_message("mcp.server_stop_failed", "停止MCP服务器失败: {error}", "Failed to stop MCP server: {error}");
        self.add_message("mcp.server_add_success", "成功添加MCP服务器: {name}", "Successfully added MCP server: {name}");
        self.add_message("mcp.server_delete_success", "成功删除MCP服务器: {name}", "Successfully deleted MCP server: {name}");
        self.add_message("mcp.invalid_server_config", "无效的服务器配置", "Invalid server configuration");
        
        // Agent messages
        self.add_message("agent.not_found", "智能体 '{name}' 未找到", "Agent '{name}' not found");
        self.add_message("agent.create_success", "成功创建智能体: {name}", "Successfully created agent: {name}");
        self.add_message("agent.delete_success", "成功删除智能体: {name}", "Successfully deleted agent: {name}");
        self.add_message("agent.execution_failed", "智能体执行失败: {error}", "Agent execution failed: {error}");
        
        // Claude messages
        self.add_message("claude.binary_not_found", "未找到Claude二进制文件", "Claude binary not found");
        self.add_message("claude.project_not_found", "项目未找到: {path}", "Project not found: {path}");
        self.add_message("claude.session_start_failed", "启动Claude会话失败: {error}", "Failed to start Claude session: {error}");
        self.add_message("claude.session_not_found", "会话未找到: {session_id}", "Session not found: {session_id}");
        
        // Clipboard messages
        self.add_message("clipboard.image_save_failed", "保存剪贴板图片失败: {error}", "Failed to save clipboard image: {error}");
        self.add_message("clipboard.no_image_data", "剪贴板中没有图片数据", "No image data in clipboard");
        
        // Usage messages
        self.add_message("usage.stats_load_failed", "加载使用统计失败: {error}", "Failed to load usage statistics: {error}");
        self.add_message("usage.stats_save_failed", "保存使用统计失败: {error}", "Failed to save usage statistics: {error}");
        
        // Slash commands messages
        self.add_message("slash.command_not_found", "斜杠命令未找到: {command}", "Slash command not found: {command}");
        self.add_message("slash.command_execution_failed", "斜杠命令执行失败: {error}", "Slash command execution failed: {error}");
        self.add_message("slash.command_add_success", "成功添加斜杠命令: {name}", "Successfully added slash command: {name}");
        self.add_message("slash.command_delete_success", "成功删除斜杠命令: {name}", "Successfully deleted slash command: {name}");
    }
}

// 全局单例实例
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

static GLOBAL_I18N: Lazy<Arc<Mutex<I18n>>> = Lazy::new(|| {
    Arc::new(Mutex::new(I18n::new(Language::Zh)))
});

pub fn set_language(language: Language) {
    if let Ok(mut i18n) = GLOBAL_I18N.lock() {
        i18n.set_language(language);
    }
}

pub fn get_language() -> Language {
    GLOBAL_I18N.lock()
        .map(|i18n| i18n.get_language().clone())
        .unwrap_or_default()
}

pub fn t(key: &str) -> String {
    GLOBAL_I18N.lock()
        .map(|i18n| i18n.t(key))
        .unwrap_or_else(|_| format!("Translation error: {}", key))
}

pub fn t_with_args(key: &str, args: &[(&str, &str)]) -> String {
    GLOBAL_I18N.lock()
        .map(|i18n| i18n.t_with_args(key, args))
        .unwrap_or_else(|_| format!("Translation error: {}", key))
}

// 便捷宏
#[macro_export]
macro_rules! t {
    ($key:expr) => {
        crate::i18n::t($key)
    };
    ($key:expr, $($arg_name:expr => $arg_value:expr),+) => {
        crate::i18n::t_with_args($key, &[$(($arg_name, $arg_value)),+])
    };
}