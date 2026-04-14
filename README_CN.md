# PaleoClaw 🦕

**古生物学和地球科学研究 AI 助手**

[English](README.md) | 中文

---

## 📖 简介

PaleoClaw 是一个专注于古生物学和地球科学的 AI 研究助手。它结合自然语言理解与经过验证的古生物学数据源，帮助研究人员进行可靠、可重复的科学研究。

**核心特点：**
- 🔬 **科学数据验证** - 所有数据均来自 PBDB、CrossRef 等权威数据库
- 📚 **文献管理** - 自动搜索、引用和管理科学文献
- 🦴 **化石数据查询** - 查询化石产地、分类学信息、地层数据
- 📊 **形态测量工具** - 化石标本测量数据格式转换
- 🔄 **记忆系统** - 追踪研究轨迹，保存研究洞察

---

## 🎯 主要功能

### v1.5.0 最新更新

#### 🆕 新增功能

| 功能 | 描述 |
|------|------|
| `geo-time-scale` | 地质年代表快速查询 |
| `morphometric-converter` | 形态测量数据格式转换 |
| `export-bibtex.ts` | 文献 BibTeX 导出工具 |
| `backup-memory.sh` | 记忆系统备份脚本 |
| `sync-research.ts` | 研究数据同步工具 |

### 历史版本功能

#### v1.2.0 - Profile Layers 系统
- 🧬 双层画像系统 (Soul/User)
- 📝 可配置的 soul.md 和 user.md
- 🔄 研究轨迹记忆系统

#### v1.1.0 - Activity Monitoring
- 🖥️ 屏幕监控与截图
- 📊 活动日志记录
- 📝 每日报告生成

#### v1.0.0 - Initial Release
- 📄 文献检索 (CrossRef/Semantic Scholar/arXiv)
- 🔍 PBDB 化石数据库查询
- 🏷️ 分类学信息查询
- 🪨 地层学数据查询

---

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/syxscott/PaleoClaw.git
cd PaleoClaw

# 安装依赖
pnpm install

# 运行开发模式
pnpm dev
```

### 配置

1. 复制配置模板：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，添加您的 API 密钥：
```env
OPENAI_API_KEY=your-api-key
CROSSREF_API_KEY=your-crossref-key
```

3. 运行设置向导：
```bash
pnpm paleoclaw setup
```

### 基本使用

```bash
# 搜索文献
pnpm paleoclaw paper search "Tyrannosaurus rex evolution"

# 查询化石数据
pnpm paleoclaw pbdb query "Triceratops"

# 查询地质年代
pnpm paleoclaw geo-time "Jurassic"

# 备份记忆数据
bash scripts/backup-memory.sh
```

---

## 📁 项目结构

```
PaleoClaw/
├── 📂 src/paleoclaw/                    # 核心模块 (v1.4.0+)
│   ├── 📂 profile/                      # 画像系统
│   │   ├── layers.ts                     # Profile 解析器
│   │   └── index.ts                      # 模块导出
│   ├── 📂 memory/                        # 记忆系统
│   │   ├── store.ts                      # 存储实现
│   │   ├── retrieval.ts                  # 检索功能
│   │   └── index.ts                      # 模块导出
│   └── 📂 cli/                           # CLI 命令
├── 📂 skills/                           # 研究技能
│   ├── 📂 paper_search/                  # 文献搜索
│   ├── 📂 pbdb_query/                    # PBDB 查询
│   ├── 📂 taxonomy_lookup/               # 分类学查询
│   ├── 📂 stratigraphy_lookup/           # 地层学查询
│   ├── 📂 geo-time-scale/                # 地质年代查询 (v1.5.0)
│   └── 📂 morphometric-converter/        # 形态测量转换 (v1.5.0)
├── 📂 scripts/                           # 工具脚本
│   ├── export-bibtex.ts                  # BibTeX 导出 (v1.5.0)
│   ├── backup-memory.sh                   # 记忆备份 (v1.5.0)
│   └── sync-research.ts                   # 数据同步 (v1.5.0)
├── 📂 prompt-templates/                  # Prompt 模板 (v1.5.0)
├── 📄 CHANGELOG.md                       # 版本历史
├── 📄 CONTRIBUTING_CN.md                 # 贡献指南
├── 📄 PaleoClaw_AGENTS.md                # 开发者指南
└── 📄 package.json
```

---

## 🛠️ Skills 列表

| Skill | 版本 | 描述 |
|-------|------|------|
| `paper_search` | v1.0.0 | 通过 CrossRef/Semantic Scholar/arXiv 搜索文献 |
| `pbdb_query` | v1.0.0 | PBDB 化石记录查询 |
| `taxonomy_lookup` | v1.0.0 | 分类学分类查询 |
| `stratigraphy_lookup` | v1.0.0 | 地质形成数据查询 |
| `morphometric_analysis` | v1.0.0 | 地标提取和分析 |
| `screen_monitor` | v1.1.0 | 屏幕截图捕获和监控 |
| `activity_logger` | v1.1.0 | 活动日志记录 |
| `daily_log_generator` | v1.1.0 | 每日报告生成 |
| `geo-time-scale` | v1.5.0 | 地质年代表快速查询 |
| `morphometric-converter` | v1.5.0 | 形态测量数据格式转换 |

---

## 📚 数据源

PaleoClaw 优先使用以下权威数据源：

1. **Paleobiology Database (PBDB)** - 主要化石数据
2. **CrossRef** - 同行评审文献元数据
3. **Semantic Scholar** - 引用分析
4. **arXiv** - 预印本（明确标注为非同行评审）
5. **NCBI Taxonomy** - 辅助分类数据

---

## 🔬 科学诚信

PaleoClaw 遵守严格的科学诚信标准：

- ✅ 所有分类学名称均通过 PBDB 验证
- ✅ 论文引用必须包含有效的 DOI
- ✅ 年代范围必须包含不确定性（以 Ma 为单位）
- ✅ 争议性解释必须清楚标注
- ✅ 数据来源必须明确引用

---

## 📖 文档

| 文档 | 描述 |
|------|------|
| [README.md](README.md) | 英文项目介绍 |
| [CHANGELOG.md](CHANGELOG.md) | 版本历史和更新日志 |
| [CONTRIBUTING_CN.md](CONTRIBUTING_CN.md) | 中文贡献指南 |
| [PaleoClaw_AGENTS.md](PaleoClaw_AGENTS.md) | 开发者指南 |
| [prompt-templates/](prompt-templates/) | 研究 Prompt 模板 |

---

## 🤝 贡献

欢迎贡献 PaleoClaw！请阅读 [CONTRIBUTING_CN.md](CONTRIBUTING_CN.md) 了解如何开始。

---

## 📄 许可证

本项目基于 OpenClaw 构建，采用相同的开源许可证。

---

## 🔗 相关链接

- 🌐 网站: https://paleoclaw.ai
- 📦 npm: https://www.npmjs.com/package/paleoclaw
- 💬 Discord: [加入讨论](https://discord.com/invite/clawd)

---

**"Ex Fossilo, Scientia" - 从化石中获取知识**

*PaleoClaw v1.5.0 | Built on PaleoClaw Framework*
