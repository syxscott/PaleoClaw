# 🦕 PaleoClaw 更新指南

## 从 v1.0.0 升级到 v1.1.0

### 概述

v1.1.0 版本添加了电脑活动监控功能，包括屏幕监控、活动日志和每日报告生成功能。所有 v1.0.0 的功能都已保留并增强。

### 升级步骤

#### 1. 备份现有数据

```bash
# 备份配置文件
cp ~/.paleoclaw/paleoclaw.json ~/.paleoclaw/paleoclaw.json.backup

# 备份会话数据（如果需要）
cp -r ~/.paleoclaw/sessions ~/.paleoclaw/sessions.backup
```

#### 2. 更新 PaleoClaw

```bash
# 使用 npm
npm update -g paleoclaw@latest

# 或使用 pnpm
pnpm update -g paleoclaw@latest
```

#### 3. 验证更新

```bash
# 检查版本
paleoclaw --version

# 应该显示: 1.1.0
```

### 新功能使用指南

#### 屏幕监控 (Screen Monitor)

开始监控你的屏幕活动：

```bash
paleoclaw agent --message "Start monitoring my screen activity"
```

查看活动摘要：

```bash
paleoclaw agent --message "What have I been working on for the past 2 hours?"
```

#### 活动日志 (Activity Logger)

开始记录活动：

```bash
paleoclaw agent --message "Start logging my computer activity"
```

查看当前会话：

```bash
paleoclaw agent --message "What have I been doing this session?"
```

#### 每日报告 (Daily Log Generator)

生成今日报告：

```bash
paleoclaw agent --message "Generate my daily log for today"
```

查找文件位置：

```bash
paleoclaw agent --message "Where did I save the file I was working on at 3 PM?"
```

生成周报：

```bash
paleoclaw agent --message "Generate my weekly activity report"
```

### 旧功能（v1.0.0）

所有 v1.0.0 的功能继续正常工作：

#### 文献检索

```bash
paleoclaw agent --message "Find papers about Jurassic theropods"
```

#### 分类学查询

```bash
paleoclaw agent --message "What is the classification of T. rex?"
```

#### 化石记录查询

```bash
paleoclaw agent --message "Query PBDB for Triceratops occurrences"
```

#### 综合研究

```bash
paleoclaw agent --message "Write a literature review on sauropod gigantism"
```

### 隐私设置

v1.1.0 添加了新的隐私配置选项：

```json
{
  "screen_monitor": {
    "enabled": true,
    "interval_seconds": 60,
    "storage_path": "~/paleoclaw-logs/screenshots",
    "auto_delete_after_days": 7,
    "blur_sensitive_areas": false,
    "exclude_applications": ["Password Manager", "Banking App"]
  },
  "activity_logger": {
    "enabled": true,
    "log_applications": true,
    "log_files": true,
    "exclude_applications": ["Password Manager", "Banking App"]
  }
}
```

### 故障排除

#### 问题：新功能无法使用

**解决方案**：确保已更新到最新版本

```bash
npm update -g paleoclaw@latest
```

#### 问题：活动日志为空

**解决方案**：确保已启动活动记录

```bash
paleoclaw agent --message "Start logging my computer activity"
```

#### 问题：隐私设置不生效

**解决方案**：检查配置文件格式

```bash
paleoclaw config get
```

### 支持

如有问题，请查看：

- [README.md](README.md) - 项目说明
- [RELEASE_NOTES.md](RELEASE_NOTES.md) - 版本说明
- [CHANGELOG.md](CHANGELOG.md) - 技术变更日志
- [GitHub Issues](https://github.com/syxscott/PaleoClaw/issues) - 报告问题

---

## v1.0.0 初始安装

如果你是首次安装 PaleoClaw：

```bash
# 1. 安装 PaleoClaw
npm install -g paleoclaw@latest

# 2. 运行安装向导
paleoclaw onboard --install-daemon

# 3. 配置 AI 模型
paleoclaw config set --ai-provider openai --ai-model gpt-5-mini

# 4. 开始使用
paleoclaw agent --message "Find papers about dinosaurs"
```

详细步骤请查看 [README.md](README.md) 中的快速开始部分。
