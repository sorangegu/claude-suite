# macOS 安装指南

## 关于未签名应用

由于 Claude Suite 是开源项目，我们没有 Apple 开发者证书进行代码签名。这意味着 macOS 会显示安全警告，但应用是完全安全的。

## 安装步骤

### 1. 下载应用
从 [Releases 页面](https://github.com/your-repo/claude-suite/releases) 下载最新的 `.dmg` 文件。

### 2. 安装应用
1. 双击下载的 `.dmg` 文件
2. 将 Claude Suite 拖拽到 Applications 文件夹

### 3. 首次运行
由于应用未签名，首次运行时会遇到安全提示：

#### 方法一：通过系统偏好设置（推荐）
1. 尝试打开应用，会看到"无法打开，因为无法验证开发者"的提示
2. 点击"好"关闭提示
3. 打开 **系统偏好设置** > **安全性与隐私** > **通用**
4. 在底部会看到关于 Claude Suite 的提示
5. 点击 **"仍要打开"** 按钮
6. 在确认对话框中点击 **"打开"**

#### 方法二：通过右键菜单
1. 在 Applications 文件夹中找到 Claude Suite
2. **按住 Control 键并点击**应用图标（或右键点击）
3. 选择 **"打开"**
4. 在弹出的对话框中点击 **"打开"**

#### 方法三：通过终端（高级用户）
```bash
# 移除隔离属性
sudo xattr -rd com.apple.quarantine /Applications/Claude\ Suite.app

# 或者临时禁用 Gatekeeper（不推荐）
sudo spctl --master-disable
```

## 权限说明

Claude Suite 需要以下权限来正常工作：

### 文件系统访问
- **用户目录**：读取 Claude 配置文件
- **系统路径**：检测 Claude CLI 安装位置
  - `/usr/local/bin/` (Homebrew)
  - `/opt/homebrew/bin/` (Apple Silicon Homebrew)
  - `/usr/bin/` (系统路径)
  - `/Applications/` (应用程序)

### 网络访问
- 与 Claude API 通信
- 下载更新（如果启用）

### 进程权限
- 启动和管理 Claude CLI 进程
- 执行系统命令

## 常见问题

### Q: 为什么需要这些权限？
A: Claude Suite 需要访问系统路径来自动检测 Claude CLI 的安装位置，这样就不需要用户手动配置路径。

### Q: 应用安全吗？
A: 是的，Claude Suite 是开源项目，所有代码都可以在 GitHub 上查看。未签名只是因为我们没有付费的 Apple 开发者账户。

### Q: 可以手动指定 Claude CLI 路径吗？
A: 是的，如果自动检测失败，应用提供了手动设置 Claude CLI 路径的选项。

### Q: 应用会收集数据吗？
A: 不会，Claude Suite 只在本地运行，不会收集或上传任何个人数据。

## 卸载

如需卸载 Claude Suite：
1. 将应用从 Applications 文件夹移到废纸篓
2. 删除配置文件（可选）：
   ```bash
   rm -rf ~/Library/Application\ Support/claude.workbench.app
   ```

## 获取帮助

如果遇到问题，请：
1. 查看 [GitHub Issues](https://github.com/your-repo/claude-suite/issues)
2. 创建新的 Issue 描述问题
3. 提供系统信息和错误日志
