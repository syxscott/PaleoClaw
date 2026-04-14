# PaleoClaw 贡献指南

## 🦕 欢迎贡献 PaleoClaw！

感谢您对 PaleoClaw 项目的关注！本文档将帮助您了解如何为 PaleoClaw 做出贡献。

---

## 📋 贡献方式

### 1. 报告问题
- 在 GitHub Issues 中报告 Bug
- 提交功能请求
- 文档改进建议

### 2. 代码贡献
- 修复 Bug
- 添加新功能
- 优化现有功能
- 编写测试

### 3. 文档贡献
- 改进文档
- 翻译文档
- 添加示例

---

## 🔧 开发环境设置

### 前提条件
- Node.js >= 22.12.0
- pnpm >= 10.32.1
- Git

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/syxscott/PaleoClaw.git
cd PaleoClaw

# 安装依赖
pnpm install

# 运行开发模式
pnpm dev
```

---

## 📁 项目结构

```
PaleoClaw/
├── src/paleoclaw/           # 核心模块
│   ├── profile/             # 画像系统
│   ├── memory/              # 记忆系统
│   └── cli/                 # CLI 命令
├── skills/                  # 研究技能
├── extensions/              # 渠道扩展
├── scripts/                # 工具脚本
└── docs/                   # 文档
```

---

## 🎯 添加新技能 (Skills)

### 1. 创建技能目录
```bash
mkdir -p skills/my-new-skill
```

### 2. 创建 SKILL.md
```markdown
# 我的新技能

## 用途
描述技能的用途。

## 使用方法
如何使用这个技能。

## 示例
示例查询和响应。
```

### 3. 创建技能实现
在 `skills/my-new-skill/` 中添加技能代码。

---

## 🧪 测试

### 运行测试
```bash
pnpm test
```

### 运行特定测试
```bash
pnpm test --filter <test-name>
```

### 运行 lint 检查
```bash
pnpm lint
```

---

## 🔬 科学诚信标准

PaleoClaw 是古生物学研究助手，所有贡献必须遵守以下标准：

### 数据验证
1. **分类学名称** - 必须通过 PBDB 验证
2. **论文引用** - 必须包含有效的 DOI
3. **年代范围** - 必须包含不确定性（以 Ma 为单位）
4. **争议性声明** - 必须清楚标记
5. **数据来源** - 必须明确引用

### 质量检查清单
在提交任何科学声明之前：
- [ ] 通过主要数据库（PBDB/CrossRef）验证
- [ ] 确认分类学名称有效性
- [ ] 验证论文 DOI
- [ ] 年代范围包含不确定性
- [ ] 标注争议性解释
- [ ] 明确引用数据来源

---

## 📝 提交规范

### 提交信息格式
```
<类型>: <简短描述>

<详细描述（可选）>
```

### 类型
- `feat:` - 新功能
- `fix:` - Bug 修复
- `docs:` - 文档更改
- `refactor:` - 代码重构
- `test:` - 测试更改

### 示例
```
feat: 添加中国化石新闻技能

- 创建 china-fossil-news 技能
- 集成国家岩矿化石网数据源
- 添加中文输出支持
```

---

## 🔀 分支管理

- `main` - 主分支，稳定版本
- `develop` - 开发分支
- `feature/*` - 功能分支
- `fix/*` - 修复分支

### 创建功能分支
```bash
git checkout -b feature/my-new-feature
```

---

## 📤 提交 Pull Request

1. Fork 仓库
2. 创建功能分支
3. 进行更改
4. 提交 PR
5. 等待审核

### PR 描述模板
```markdown
## 描述
简要描述您的更改。

## 更改类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 代码重构

## 测试
描述您如何测试这些更改。

## 截图（如适用）
添加截图或 GIF。
```

---

## 📚 相关资源

- [GitHub 仓库](https://github.com/syxscott/PaleoClaw)
- [问题反馈](https://github.com/syxscott/PaleoClaw/issues)
- [讨论区](https://github.com/syxscott/PaleoClaw/discussions)

---

## ❓ 联系我们

如果您有任何问题，请通过以下方式联系我们：
- GitHub Issues
- GitHub Discussions
- 发送邮件至项目维护者

---

**感谢您的贡献！**
