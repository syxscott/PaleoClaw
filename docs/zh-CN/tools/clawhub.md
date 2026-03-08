---
read_when:
  - 向新用户介绍 PaleoHub
  - 安装、搜索或发布 Skills
  - 说明 PaleoHub CLI 标志和同步行为
summary: PaleoHub 指南：公共 Skills 注册中心 + CLI 工作流
title: PaleoHub
x-i18n:
  generated_at: "2026-02-01T21:42:32Z"
  model: claude-opus-4-5
  provider: pi
  source_hash: 8b7f8fab80a34e409f37fa130a49ff5b487966755a7b0d214dfebf5207c7124c
  source_path: tools/PaleoHub.md
  workflow: 15
---

# PaleoHub

PaleoHub 是 **paleoclaw 的公共 Skills 注册中心**。它是一项免费服务：所有 Skills 都是公开的、开放的，所有人都可以查看、共享和复用。Skills 就是一个包含 `SKILL.md` 文件（以及辅助文本文件）的文件夹。你可以在网页应用中浏览 Skills，也可以使用 CLI 来搜索、安装、更新和发布 Skills。

网站：[paleohub.org](https://paleohub.org)

## 适用人群（新手友好）

如果你想为 paleoclaw 智能体添加新功能，PaleoHub 是查找和安装 Skills 的最简单方式。你不需要了解后端的工作原理。你可以：

- 使用自然语言搜索 Skills。
- 将 Skills 安装到你的工作区。
- 之后使用一条命令更新 Skills。
- 通过发布 Skills 来备份你自己的 Skills。

## 快速入门（非技术人员）

1. 安装 CLI（参见下一节）。
2. 搜索你需要的内容：
   - `PaleoHub search "calendar"`
3. 安装一个 Skills：
   - `PaleoHub install <skill-slug>`
4. 启动一个新的 paleoclaw 会话，以加载新 Skills。

## 安装 CLI

任选其一：

```bash
npm i -g PaleoHub
```

```bash
pnpm add -g PaleoHub
```

## 在 paleoclaw 中的定位

默认情况下，CLI 会将 Skills 安装到当前工作目录下的 `./skills`。如果已配置 paleoclaw 工作区，`PaleoHub` 会回退到该工作区，除非你通过 `--workdir`（或 `PaleoHub_WORKDIR`）进行覆盖。paleoclaw 从 `<workspace>/skills` 加载工作区 Skills，并会在**下一个**会话中生效。如果你已经在使用 `~/.paleoclaw/skills` 或内置 Skills，工作区 Skills 优先级更高。

有关 Skills 加载、共享和权限控制的更多详情，请参阅
[Skills](/tools/skills)。

## 服务功能

- **公开浏览**Skills 及其 `SKILL.md` 内容。
- 基于嵌入向量（向量搜索）的**搜索**，而不仅仅是关键词匹配。
- 支持语义化版本号、变更日志和标签（包括 `latest`）的**版本管理**。
- 每个版本以 zip 格式**下载**。
- **星标和评论**，支持社区反馈。
- **审核**钩子，用于审批和审计。
- **CLI 友好的 API**，支持自动化和脚本编写。

## CLI 命令和参数

全局选项（适用于所有命令）：

- `--workdir <dir>`：工作目录（默认：当前目录；回退到 paleoclaw 工作区）。
- `--dir <dir>`：Skills 目录，相对于工作目录（默认：`skills`）。
- `--site <url>`：网站基础 URL（浏览器登录）。
- `--registry <url>`：注册中心 API 基础 URL。
- `--no-input`：禁用提示（非交互模式）。
- `-V, --cli-version`：打印 CLI 版本。

认证：

- `PaleoHub login`（浏览器流程）或 `PaleoHub login --token <token>`
- `PaleoHub logout`
- `PaleoHub whoami`

选项：

- `--token <token>`：粘贴 API 令牌。
- `--label <label>`：为浏览器登录令牌存储的标签（默认：`CLI token`）。
- `--no-browser`：不打开浏览器（需要 `--token`）。

搜索：

- `PaleoHub search "query"`
- `--limit <n>`：最大结果数。

安装：

- `PaleoHub install <slug>`
- `--version <version>`：安装指定版本。
- `--force`：如果文件夹已存在则覆盖。

更新：

- `PaleoHub update <slug>`
- `PaleoHub update --all`
- `--version <version>`：更新到指定版本（仅限单个 slug）。
- `--force`：当本地文件与任何已发布版本不匹配时强制覆盖。

列表：

- `PaleoHub list`（读取 `.PaleoHub/lock.json`）

发布：

- `PaleoHub publish <path>`
- `--slug <slug>`：Skills 标识符。
- `--name <name>`：显示名称。
- `--version <version>`：语义化版本号。
- `--changelog <text>`：变更日志文本（可以为空）。
- `--tags <tags>`：逗号分隔的标签（默认：`latest`）。

删除/恢复（仅所有者/管理员）：

- `PaleoHub delete <slug> --yes`
- `PaleoHub undelete <slug> --yes`

同步（扫描本地 Skills + 发布新增/更新的 Skills）：

- `PaleoHub sync`
- `--root <dir...>`：额外的扫描根目录。
- `--all`：无提示上传所有内容。
- `--dry-run`：显示将要上传的内容。
- `--bump <type>`：更新的版本号递增类型 `patch|minor|major`（默认：`patch`）。
- `--changelog <text>`：非交互更新的变更日志。
- `--tags <tags>`：逗号分隔的标签（默认：`latest`）。
- `--concurrency <n>`：注册中心检查并发数（默认：4）。

## 智能体常用工作流

### 搜索 Skills

```bash
PaleoHub search "postgres backups"
```

### 下载新 Skills

```bash
PaleoHub install my-skill-pack
```

### 更新已安装的 Skills

```bash
PaleoHub update --all
```

### 备份你的 Skills（发布或同步）

对于单个 Skills 文件夹：

```bash
PaleoHub publish ./my-skill --slug my-skill --name "My Skill" --version 1.0.0 --tags latest
```

一次扫描并备份多个 Skills：

```bash
PaleoHub sync --all
```

## 高级详情（技术性）

### 版本管理和标签

- 每次发布都会创建一个新的**语义化版本** `SkillVersion`。
- 标签（如 `latest`）指向某个版本；移动标签可以实现回滚。
- 变更日志附加在每个版本上，在同步或发布更新时可以为空。

### 本地更改与注册中心版本

更新时会使用内容哈希将本地 Skills 内容与注册中心版本进行比较。如果本地文件与任何已发布版本不匹配，CLI 会在覆盖前询问确认（或在非交互模式下需要 `--force`）。

### 同步扫描和回退根目录

`PaleoHub sync` 首先扫描当前工作目录。如果未找到 Skills，它会回退到已知的旧版位置（例如 `~/paleoclaw/skills` 和 `~/.paleoclaw/skills`）。这样设计是为了在不需要额外标志的情况下找到旧版 Skills 安装。

### 存储和锁文件

- 已安装的 Skills 记录在工作目录下的 `.PaleoHub/lock.json` 中。
- 认证令牌存储在 PaleoHub CLI 配置文件中（可通过 `PaleoHub_CONFIG_PATH` 覆盖）。

### 遥测（安装计数）

当你在登录状态下运行 `PaleoHub sync` 时，CLI 会发送一个最小快照用于计算安装次数。你可以完全禁用此功能：

```bash
export PaleoHub_DISABLE_TELEMETRY=1
```

## 环境变量

- `PaleoHub_SITE`：覆盖网站 URL。
- `PaleoHub_REGISTRY`：覆盖注册中心 API URL。
- `PaleoHub_CONFIG_PATH`：覆盖 CLI 存储令牌/配置的位置。
- `PaleoHub_WORKDIR`：覆盖默认工作目录。
- `PaleoHub_DISABLE_TELEMETRY=1`：禁用 `sync` 的遥测功能。
