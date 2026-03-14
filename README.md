<div align="center">

# 🦕 PaleoClaw

**An AI Research Agent for Paleontology**  
**古生物学 AI 研究助手**

<p>
  <em>"Ex Fossilo, Scientia" — From Fossils, Knowledge</em>  
  <em>"源于化石，成就知识"</em>
</p>

<p>
  <a href="https://github.com/syxscott/PaleoClaw">
    <img src="https://img.shields.io/badge/version-1.4.0-blue.svg?style=for-the-badge" alt="Version">
  </a>
  <a href="https://github.com/syxscott/PaleoClaw/actions/workflows/ci.yml?branch=main">
    <img src="https://img.shields.io/github/actions/workflow/status/syxscott/PaleoClaw/ci.yml?branch=main&style=for-the-badge" alt="CI status">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="MIT License">
  </a>
</p>

<p>
  <a href="README_CN.md">🇨🇳 中文版</a> |
  <a href="#-quick-start">🚀 Quick Start</a> |
  <a href="#-features">✨ Features</a> |
  <a href="#-documentation">📚 Docs</a>
</p>

</div>

---

## 📢 What's New | 最新动态

<div align="center">

### 🎉 v1.4.0 (2026-03-14) — Reliability & Research Workflow Stabilization | 稳定性与科研流程修复

</div>

<table>
<tr>
<th width="50%" align="center"><strong>📐 Morphometric Analysis | 形态测量学分析</strong></th>
<th width="50%" align="center"><strong>🔍 New CLI Commands | 新增命令</strong></th>
</tr>
<tr>
<td>

- 64 landmarks (all semilandmarks) | 64 个地标点
- TPS/CSV/Excel/JSON export | 多格式导出
- Compatible with MorphoJ & geomorph | 兼容主流 GM 软件
- Pure Node.js, no Python deps | 纯 Node.js 实现
- Based on DeepMorph (Xiaokang Liu @ CUG) | 基于 DeepMorph

**🖼️ Visualization | 可视化**
- Landmark overlay images | 地标点标注图
- Before/after comparison | 处理前后对比
- Batch processing support | 批量处理支持

</td>
<td>

```bash
# Single image analysis | 单图像分析
paleoclaw agent --message "Extract landmarks from ammonoid.png"

# Batch processing | 批量处理
paleoclaw agent --message "Batch process specimens/ folder"

# Export formats | 导出格式
paleoclaw agent --message "Export as TPS for MorphoJ"
```

**📊 Supported Fossils | 支持化石类型**
- Ammonoids (菊石) | Brachiopods (腕足)
- Bivalves (双壳) | Gastropods (腹足)
- Trilobites (三叶虫) | Any clear silhouette

</td>
</tr>
</table>

<br>

<table>
<tr>
<th width="50%" align="center"><strong>🧬 Profile Layers | 个人画像分层</strong></th>
<th width="50%" align="center"><strong>🔍 New CLI Commands | 新增命令</strong></th>
</tr>
<tr>
<td>

- `soul.md` — System identity & principles | 系统身份与核心原则
- `user.md` — Personal research preferences | 个人研究偏好设置
- Double-layer personalization | 双层个性化架构

**🧠 Memory System | 记忆系统**
- Short-term & long-term memory | 短期与长期记忆
- Vector-based similarity search | 基于向量的相似度搜索
- Research trajectory tracking | 研究轨迹追踪
- CLI wiring fixed (`profile` / `paleo-memory`) | 命令链路已修复

**🛠️ 1.4.0 Reliability Fixes | 稳定性修复**
- Morphometric config key consistency (`numLandmarks`) | 形态分析参数命名统一
- Visualization color option consistency (`landmarkColor`) | 可视化颜色参数统一
- Excel export path consistency (`.xlsx` path no longer rewritten) | Excel 导出路径一致性修复

</td>
<td>

```bash
# Profile management | 画像管理
paleoclaw profile init    # Initialize | 初始化
paleoclaw profile show    # Display | 显示配置

# Memory management | 记忆管理
paleoclaw paleo-memory status     # Statistics | 状态统计
paleoclaw paleo-memory short      # Short-term | 短期记忆
paleoclaw paleo-memory long       # Long-term | 长期记忆
paleoclaw paleo-memory search     # Search | 内容搜索
paleoclaw paleo-memory archive    # Archive | 归档清理
```

</td>
</tr>
</table>

<details>
<summary><b>📜 Previous Versions | 历史版本</b></summary>

### v1.1.0 — Activity Monitoring | 活动监控
- 🖥️ Screen monitoring & screenshot capture | 屏幕监控与截图
- 📝 Activity logging (apps, files, websites) | 活动日志记录
- 📊 Daily productivity reports in Markdown | 每日生产力报告

### v1.0.0 — Initial Release | 初始版本
- 📄 Paper search via CrossRef/Semantic Scholar/arXiv | 文献搜索
- 🦕 PBDB fossil occurrence queries | PBDB 化石记录查询
- 🧬 Taxonomic classification lookup | 分类学查询
- 📊 Stratigraphy & formation data | 地层学数据

</details>

---

## 🎯 Features | 功能特性

<div align="center">

### ✨ Core Capabilities | 核心能力

</div>

<table>
<tr>
<th width="33%" align="center">🔬 Research | 研究功能</th>
<th width="33%" align="center">🧠 Intelligence | 智能功能</th>
<th width="33%" align="center">⚙️ Productivity | 生产力</th>
</tr>
<tr>
<td>

**Literature Search | 文献搜索**
- CrossRef, Semantic Scholar, arXiv
- DOI validation & citation formatting
- Multi-source aggregation

**Database Queries | 数据库查询**
- PBDB fossil occurrences
- Taxonomic classifications
- Stratigraphic information

**Bug Fixes & Improvements | 错误修复与改进** (v1.3.1+)
- 64 landmarks extraction
- TPS/CSV/Excel/JSON export
- MorphoJ & geomorph compatible
- Based on DeepMorph (Xiaokang Liu @ CUG)

</td>
<td>

**AI-Powered Analysis | AI 分析**
- Paper summarization
- Research synthesis
- Taxonomic verification

**Memory System | 记忆系统**
- Research history tracking
- Smart content retrieval
- Pattern recognition

</td>
<td>

**Activity Monitoring | 活动监控**
- Work session tracking
- Productivity metrics
- Daily log generation

**Profile Customization | 个性化**
- Research preference profiles
- Output format customization
- Workflow optimization

</td>
</tr>
</table>

---

## 🚀 Quick Start | 快速开始

### Prerequisites | 环境要求

<div align="center">

| Requirement | Version | Description |
|-------------|---------|-------------|
| **Node.js** | >= 22.12.0 | Runtime environment | 运行环境 |
| **curl** | latest | API calls | API 调用工具 |
| **Git** | latest | Version control | 版本控制 |

</div>

### Installation Methods | 安装方式

#### 📦 Recommended: Official Installer Script | 推荐：官方安装脚本

**For macOS / Linux / WSL:**
```bash
curl -fsSL https://paleoclaw.ai/install.sh | bash
```

**For Windows (PowerShell):**
```powershell
iwr -useb https://paleoclaw.ai/install.ps1 | iex
```

#### 📦 Alternative: npm/pnpm Installation | 替代方案：npm/pnpm 安装

**Using npm:**
```bash
npm install -g paleoclaw@latest
paleoclaw onboard --install-daemon
```

**Using pnpm:**
```bash
pnpm add -g paleoclaw@latest
pnpm approve-builds -g        # approve paleoclaw, node-llama-cpp, sharp, etc.
paleoclaw onboard --install-daemon
```

#### 🐳 Docker Installation | Docker 安装

```bash
git clone https://github.com/syxscott/PaleoClaw.git
cd PaleoClaw
./docker-setup.sh
```

#### 🔧 From Source | 从源码安装

```bash
git clone https://github.com/syxscott/PaleoClaw.git
cd PaleoClaw
pnpm install
pnpm ui:build
pnpm build
pnpm link --global
```

### Post-Installation Setup | 安装后设置

```bash
# Initialize profile layers | 初始化个人画像
paleoclaw profile init

# Configure AI provider | 配置 AI 提供商
paleoclaw config set --ai-provider openai --ai-model gpt-5-mini

# Verify installation | 验证安装
paleoclaw --version
paleoclaw doctor
```

### First Use | 首次使用

```bash
# Start the gateway | 启动网关
paleoclaw gateway --port 18789 --verbose

# Example queries | 示例查询
paleoclaw agent --message "Find papers about Jurassic theropods"
paleoclaw agent --message "Query PBDB for Tyrannosaurus occurrences"
paleoclaw agent --message "What is the classification of Velociraptor?"
```

### Troubleshooting | 故障排除

#### Command Not Found | 命令未找到

If `paleoclaw` command is not found after installation:
```bash
# Check Node.js version
node -v

# Check npm global prefix
npm prefix -g

# Add to PATH (macOS/Linux)
export PATH="$(npm prefix -g)/bin:$PATH"
```

#### Permission Errors | 权限错误 (Linux)
```bash
# Set npm prefix to user directory
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
```

---

## 📋 Usage Examples | 使用示例

<div align="center">

### 🧬 Profile & Memory Management | 画像与记忆管理

</div>

**Initialize Profile Layers | 初始化画像层:**
```bash
# Initialize dual-layer profile system | 初始化双层画像系统
paleoclaw profile init

# Show current profile configuration | 显示当前画像配置
paleoclaw profile show
```

**Memory System Commands | 记忆系统命令:**
```bash
# Memory status | 记忆状态
paleoclaw paleo-memory status

# List short-term memories | 列出短期记忆
paleoclaw paleo-memory short

# List long-term memories | 列出长期记忆
paleoclaw paleo-memory long

# Search memories | 搜索记忆
paleoclaw paleo-memory search "previous research on tyrannosaurus"

# Archive old memories | 归档旧记忆
paleoclaw paleo-memory archive
```

<div align="center">

### 🔍 Literature Search | 文献搜索

</div>

**Command | 命令:**
```bash
paleoclaw agent --message "Find papers about dinosaur extinction at K-Pg boundary from 2020-2026"
```

**Output | 输出:**
```
📄 Research Papers Found | 找到的研究论文:

1. The last dinosaurs: K-Pg boundary extinction patterns
   最后恐龙的灭绝：K-Pg 边界灭绝模式
   ├─ Authors: Smith, J., Johnson, K., Williams, R.
   ├─ Year: 2023
   ├─ Journal: Paleobiology
   ├─ DOI: 10.1016/j.palaeo.2023.111234
   └─ Citations: 42

2. Iridium anomalies and dinosaur extinction
   铱异常与恐龙灭绝
   ├─ Authors: Chen, L., et al.
   ├─ Year: 2022
   ├─ Journal: Cretaceous Research
   ├─ DOI: 10.1016/j.cretres.2022.105234
   └─ Citations: 28
```

<div align="center">

### 🧬 Taxonomy Lookup | 分类学查询

</div>

**Command | 命令:**
```bash
paleoclaw agent --message "What is the full classification of Velociraptor mongoliensis?"
```

**Output | 输出:**
```
🦕 Taxonomic Classification | 分类学信息

Name | 名称: Velociraptor mongoliensis
Rank | 等级: species | 种
Status | 状态: valid | 有效

Full Hierarchy | 完整分类层级:
└─ Kingdom | 界: Animalia | 动物界
   └─ Phylum | 门: Chordata | 脊索动物门
      └─ Class | 纲: Dinosauria | 恐龙纲
         └─ Order | 目: Saurischia | 蜥臀目
            └─ Suborder | 亚目: Theropoda | 兽脚亚目
               └─ Family | 科: Dromaeosauridae | 驰龙科
                  └─ Genus | 属: Velociraptor | 伶盗龙属
                     └─ Species | 种: V. mongoliensis | 蒙古伶盗龙

Data source | 数据来源: Paleobiology Database (queried 2026-03-09)
```

<div align="center">

### 🗺️ Fossil Occurrences | 化石记录

</div>

**Command | 命令:**
```bash
paleoclaw agent --message "Where have Tyrannosaurus fossils been found? Query PBDB."
```

**Output | 输出:**
```
🗺️ Fossil Occurrences for Tyrannosaurus | 霸王龙化石记录

📍 Location 1 | 地点 1: Montana, USA | 美国蒙大拿州
   ├─ Coordinates | 坐标: 45.0, -110.0
   ├─ Age | 年代: 66 Ma | 6600万年前
   └─ Formation | 地层: Hell Creek Formation | 地狱溪组

📍 Location 2 | 地点 2: South Dakota, USA | 美国南达科他州
   ├─ Coordinates | 坐标: 43.5, -102.5
   ├─ Age | 年代: 66 Ma
   └─ Formation | 地层: Hell Creek Formation

📍 Location 3 | 地点 3: Wyoming, USA | 美国怀俄明州
   ├─ Coordinates | 坐标: 44.0, -107.0
   ├─ Age | 年代: 66 Ma
   └─ Formation | 地层: Lance Formation | 兰斯组

📊 Total occurrences | 总记录数: ~50
🔗 Data source | 数据来源: PBDB (paleobiodb.org)
```

<div align="center">

### 🏔️ Stratigraphy Query | 地层查询

</div>

**Command | 命令:**
```bash
paleoclaw agent --message "What is the age and location of Yixian Formation?"
```

**Output | 输出:**
```
🏔️ Stratigraphic Information | 地层信息

Formation | 地层名称: Yixian Formation | 义县组
Age | 年代: ~125 Ma | 约1.25亿年前
Period | 纪: Early Cretaceous | 早白垩世
Epoch | 世: Barremian-Aptian | 巴列姆期-阿普特期
Location | 地点: Liaoning, China | 中国辽宁
Lithology | 岩性: Volcaniclastic sediments | 火山碎屑沉积

🦕 Associated Fossils | 相关化石:
• Sinosauropteryx prima — First feathered dinosaur | 第一种带羽毛恐龙
• Confuciusornis sanctus — Early bird | 早期鸟类
• Psittacosaurus lujiatunensis — Ceratopsian | 鹦鹉嘴龙

⭐ Significance | 重要性: Lagerstätte with exceptional preservation
              具有 exceptional 保存状态的化石库
```

<div align="center">

### 📐 Bug Fixes & Improvements | 错误修复与改进 (v1.4.0+)

</div>

**Command | 命令:**
```bash
paleoclaw agent --message "Extract landmarks from ammonoid.png"
```

**Output | 输出:**
```
📐 Morphometric Analysis Results | 形态测量分析结果

Specimen | 标本: ammonoid
Image Size | 图像尺寸: 512 x 512 pixels

Landmarks Detected | 检测到的地标点:
├─ 64 Landmarks (all semilandmarks) | 64 个地标点（全部为半地标点）
│  ├─ #1 LM1: (256, 128)
│  ├─ #2 LM2: (260, 130)
│  ├─ ... (62 more)
│  └─ #64 LM64: (255, 129)

Export Files | 导出文件:
├─ 📄 TPS: data/outputs/morphometrics/tps/ammonoid.tps
├─ 📊 CSV: data/outputs/morphometrics/csv/ammonoid.csv
├─ 📝 JSON: data/outputs/morphometrics/json/ammonoid.json
└─ 🖼️ Visualization: data/outputs/morphometrics/visualizations/ammonoid_landmarks.png

Compatible with | 兼容软件: MorphoJ, R geomorph, TPSdig
Based on | 基于: DeepMorph by Xiaokang Liu @ CUG
```

**Batch Processing | 批量处理:**
```bash
paleoclaw agent --message "Batch process all images in specimens/ folder"
```

**Output | 输出:**
```
📦 Batch Processing Complete | 批量处理完成

Total specimens | 总标本数: 25
Successfully processed | 成功处理: 23
Failed | 失败: 2

Results saved to | 结果保存至: data/outputs/morphometrics/
├─ tps/batch_results.tps
├─ csv/batch_results.csv
├─ json/batch_results.json
└─ visualizations/

Time elapsed | 耗时: 12.5 seconds
```

---

## 🔧 Configuration | 配置

### Environment Variables | 环境变量

```bash
# AI Provider Configuration | AI 提供商配置
export PALEOCLAW_AI_PROVIDER=openai
export PALEOCLAW_AI_MODEL=gpt-5-mini
export PALEOCLAW_AI_API_KEY=your-api-key

# Alternative Providers | 其他提供商
export PALEOCLAW_AI_PROVIDER=qwen
export PALEOCLAW_AI_MODEL=qwen-plus-latest

# Profile Paths | 画像文件路径
export PALEOCLAW_SOUL_PATH=/path/to/soul.md
export PALEOCLAW_USER_PATH=/path/to/user.md
```

### Config File | 配置文件

**Location | 位置:** `~/.paleoclaw/paleoclaw.json`

```json
{
  "agent": {
    "model": "openai/gpt-5-mini",
    "language": "zh-CN"
  },
  "skills": {
    "load": {
      "extraDirs": ["~/.paleoclaw/skills"]
    }
  },
  "memory": {
    "autoArchive": true,
    "archiveAfterDays": 7
  }
}
```

---

## 📁 Project Structure | 项目结构

```
PaleoClaw/
├── 📂 agents/                           # Agent configurations | 代理配置
│   └── paleoclaw-research-agent/
│       └── AGENT.md
├── 📂 skills/                           # Research skills | 研究技能
│   ├── 📄 paper_search/                 # Literature search | 文献搜索
│   ├── 🦕 pbdb_query/                   # Fossil database | 化石数据库
│   ├── 🧬 taxonomy_lookup/              # Taxonomy | 分类学
│   ├── 📊 stratigraphy_lookup/          # Stratigraphy | 地层学
│   ├── 📝 paper_summary/                # Paper summarization | 论文摘要
│   ├── 🎯 research_assistant/           # Research workflow | 研究工作流
│   ├── 📐 morphometric_analysis/        # 64 landmarks + DeepMorph-based workflow
│   ├── 🖥️ screen_monitor/               # Screen monitoring | 屏幕监控
│   ├── 📝 activity_logger/              # Activity logging | 活动记录
│   └── 📊 daily_log_generator/          # Daily reports | 日报生成
├── 📂 src/paleoclaw/                    # Core modules (v1.4.0+) | 核心模块
│   ├── 📂 profile/                      # Profile system | 画像系统
│   │   ├── layers.ts                    # Profile parser | 画像解析器
│   │   └── index.ts
│   ├── 📂 memory/                       # Memory system | 记忆系统
│   │   ├── store.ts                     # Memory storage | 记忆存储
│   │   ├── retrieval.ts                 # Vector search | 向量搜索
│   │   └── index.ts
│   ├── 📂 cli/                          # CLI commands | 命令行接口
│   │   ├── profile-cli.ts               # Profile commands | 画像命令
│   │   ├── memory-cli.ts                # Memory commands | 记忆命令
│   │   └── index.ts
│   └── index.ts
├── 📂 docs/                             # Documentation | 文档
├── 📂 scripts/                          # Utility scripts | 工具脚本
├── 📄 soul.md                           # System identity | 系统身份
├── 📄 user.md                           # User preferences | 用户偏好
├── 📄 PALEOCLAW_IDENTITY.md             # Core system prompt | 核心系统提示
├── 📄 CHANGELOG.md                      # Version history | 版本历史
├── 📄 UPGRADE_GUIDE_v1.2.0.md           # Upgrade guide | 升级指南
├── 📄 v1.2.0_CHECKLIST.md               # Release checklist | 发布检查清单
├── 📄 package.json
├── 📄 README.md
└── 📄 LICENSE
```

---

## 🔬 Scientific Integrity | 科学诚信

<div align="center">

### ✅ Our Commitment | 我们的承诺

</div>

<table>
<tr>
<th align="center" width="25%">🔍 No Fabrication</th>
<th align="center" width="25%">📚 Verifiable Citations</th>
<th align="center" width="25%">⚠️ Transparent Uncertainty</th>
<th align="center" width="25%">🔄 Reproducible</th>
</tr>
<tr>
<td align="center">

**不编造数据**

All data verified against primary sources
所有数据均经过原始来源验证

</td>
<td align="center">

**可验证引用**

Every paper includes valid DOI
每篇论文都包含有效 DOI

</td>
<td align="center">

**透明的不确定性**

Clearly marks disputed data
清楚标记有争议的数据

</td>
<td align="center">

**可复现**

Documents all queries and parameters
记录所有查询和参数

</td>
</tr>
</table>

### Data Verification Standards | 数据验证标准

1. **Taxonomic names** verified via PBDB | 分类学名称通过 PBDB 验证
2. **Paper citations** include valid DOI | 论文引用包含有效 DOI
3. **Age ranges** include uncertainty (in Ma) | 年代范围包含不确定性（百万年）
4. **Disputed claims** clearly marked | 有争议的声明清楚标记
5. **Data sources** explicitly cited | 数据来源明确引用

### Handling Unknown Data | 处理未知数据

When data is unavailable | 当数据不可用时:

```
⚠️ No verified fossil occurrences found in PBDB for [taxon name].
   在 PBDB 中未找到 [分类群名称] 的已验证化石记录。

This may indicate | 这可能表明:
• Limited fossil record | 化石记录有限
• Recent taxonomic revision | 最近的分类学修订
• Data not yet in database | 数据尚未录入数据库

Recommendation | 建议: Check primary literature for recent discoveries.
              查阅原始文献以获取最新发现。
```

---

## 📚 Documentation | 文档

<div align="center">

| Document | Description | 描述 |
|----------|-------------|------|
| [INSTALL.md](docs/install/index.md) | Installation guide | 安装指南 |
| [USAGE_EXAMPLES.md](docs/USAGE_EXAMPLES.md) | Detailed usage guide | 详细使用指南 |
| [INTEGRATION.md](docs/INTEGRATION.md) | Channel integration guide | 渠道集成指南 |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Contributor guide | 贡献者指南 |
| [START.md](docs/start/index.md) | Getting started guide | 快速入门指南 |
| [PALEOCLAW_IDENTITY.md](PALEOCLAW_IDENTITY.md) | Core system prompt | 核心系统提示 |
| [CHANGELOG.md](CHANGELOG.md) | Version history | 版本历史 |
| [UPGRADE_GUIDE_v1.2.0.md](UPGRADE_GUIDE_v1.2.0.md) | Upgrade instructions | 升级说明 |

</div>

---

## 🤝 Contributing | 贡献

We welcome contributions! Areas of interest | 我们欢迎贡献！感兴趣的领域：

- 🌍 New data source integrations | 新数据源集成
- 🔧 Additional research skills | 额外的研究技能
- 📝 Improved citation formatting | 改进的引用格式
- 🌐 Non-English language support | 非英语语言支持
- 📖 Documentation improvements | 文档改进

### How to Contribute | 如何贡献

1. **Fork** the repository | Fork 仓库
2. **Create** a feature branch | 创建功能分支
3. **Make** your changes | 进行更改
4. **Run** tests: `bash scripts/test.sh` | 运行测试
5. **Submit** a pull request | 提交 Pull Request

---

## 📜 License | 许可证

**MIT License** — see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments | 致谢

<div align="center">

| Data Source | Provider | Description |
|-------------|----------|-------------|
| 🦕 **PBDB** | [Paleobiology Database](https://paleobiodb.org/) | Fossil occurrences & taxonomy | 化石记录与分类学 |
| 📚 **CrossRef** | [CrossRef](https://www.crossref.org/) | Literature metadata | 文献元数据 |
| 📊 **Semantic Scholar** | [Semantic Scholar](https://www.semanticscholar.org/) | Citation analysis | 引用分析 |
| 📝 **arXiv** | [arXiv](https://arxiv.org/) | Preprints | 预印本 |
| 📐 **DeepMorph** | [Xiaokang Liu @ CUG](mailto:xkliu@cug.edu.cn) | Morphometric algorithms | 形态测量算法 |

</div>

---

## 📖 Citation | 引用

If you use PaleoClaw in your research, please cite | 如果您在研究中使用 PaleoClaw，请引用：

```bibtex
@software{paleoclaw2026,
  author = {PaleoClaw Contributors},
  title = {PaleoClaw: An AI Research Agent for Paleontology},
  year = {2026},
  url = {https://github.com/syxscott/PaleoClaw}
}
```

**Data Source | 数据来源:**
```
Paleobiology Database (PBDB): https://paleobiodb.org/
```

---

## 🔗 Support & Community | 支持与社区

<div align="center">

| Channel | Link | Description |
|---------|------|-------------|
| 🐛 **Issues** | [GitHub Issues](https://github.com/syxscott/PaleoClaw/issues) | Bug reports & feature requests | 错误报告与功能请求 |
| 💬 **Discussions** | [GitHub Discussions](https://github.com/syxscott/PaleoClaw/discussions) | Community Q&A | 社区问答 |
| 📖 **Documentation** | [GitHub Docs](https://github.com/syxscott/PaleoClaw/docs) | Full documentation | 完整文档 |
| 🌐 **Website** | [paleoclaw.ai](https://paleoclaw.ai/) | Official website | 官方网站 |
| 📧 **Email** | [support@paleoclaw.ai](mailto:support@paleoclaw.ai) | Support contact | 支持联系邮箱 |

</div>

---

<div align="center">

### 🦕 PaleoClaw: An AI Assistant for Paleontological Research
### 🦕 PaleoClaw：古生物学研究的 AI 助手

<p>
  <em>"Ex Fossilo, Scientia" — From Fossils, Knowledge</em><br>
  <em>"源于化石，成就知识"</em>
</p>

<p>
  <sub>Built with ❤️ by the PaleoClaw Team | 由 PaleoClaw 团队用 ❤️ 构建</sub>
</p>

</div>