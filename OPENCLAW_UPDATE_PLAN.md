# PaleoClaw OpenClaw 4.14 更新计划

## 概述

将 PaleoClaw 从 openclaw-main（下载日期 2026.3.8）更新到 openclaw-main（下载日期 2026.4.14）

**说明**：版本号中的 3.8 和 4.14 表示下载日期（月份.日期），而非 OpenClaw 的语义化版本。

## 合并策略

**原则**：逐步合并，只合并必要的依赖和 exports，保留 PaleoClaw 特有的配置和功能

## 1. 需要更新的部分

### 1.1 dependencies 版本升级
| 包名 | 3.8 版本 | 4.14 版本 |
|------|---------|----------|
| @agentclientprotocol/sdk | 0.15.0 | 0.18.2 |
| @aws-sdk/client-bedrock | ^3.1004.0 | 3.1028.0 |
| @buape/carbon | 0.0.0-beta-20260216184201 | 0.15.0 |
| @clack/prompts | ^1.1.0 | ^1.2.0 |
| @grammyjs/runner | ^2.0.3 | ^2.0.3 |
| @grammyjs/transformer-throttler | ^1.2.1 | ^1.2.1 |
| @homebridge/ciao | ^1.3.5 | ^1.3.6 |
| @line/bot-sdk | ^10.6.0 | ^11.0.0 |
| @lydell/node-pty | 1.2.0-beta.3 | 1.2.0-beta.12 |
| @mariozechner/* | 0.55.3 | 0.66.1 |
| @sinclair/typebox | 0.34.48 | 0.34.49 |
| @slack/bolt | ^4.6.0 | ^4.7.0 |
| @slack/web-api | ^7.14.1 | ^7.15.0 |
| @whiskeysockets/baileys | 7.0.0-rc.9 | 7.0.0-rc.9 |
| discord-api-types | ^0.38.41 | ^0.38.45 |
| dotenv | ^17.3.1 | ^17.4.1 |
| express | ^5.2.1 | ^5.2.1 |
| file-type | ^21.3.0 | 22.0.1 |
| grammy | ^1.41.1 | ^1.42.0 |
| https-proxy-agent | ^7.0.6 | ^9.0.0 |
| jiti | ^2.6.1 | ^2.6.1 |
| json5 | ^2.2.3 | ^2.2.3 |
| jszip | ^3.10.1 | ^3.10.1 |
| linkedom | ^0.18.12 | ^0.18.12 |
| markdown-it | ^14.1.1 | 14.1.1 |
| node-edge-tts | ^1.2.10 | ^1.2.10 |
| opusscript | ^0.1.1 | ^0.1.1 |
| osc-progress | ^0.3.0 | ^0.3.0 |
| pdfjs-dist | ^5.5.207 | ^5.6.205 |
| playwright-core | 1.58.2 | 1.59.1 |
| qrcode-terminal | ^0.12.0 | ^0.12.0 |
| sharp | ^0.34.5 | ^0.34.5 |
| sqlite-vec | 0.1.7-alpha.2 | 0.1.9 |
| tar | 7.5.10 | 7.5.13 |
| tslog | ^4.10.2 | ^4.10.2 |
| undici | ^7.22.0 | 8.0.2 |
| ws | ^8.19.0 | ^8.20.0 |
| yaml | ^2.8.2 | ^2.8.3 |
| zod | ^4.3.6 | ^4.3.6 |

### 1.2 devDependencies 版本升级
| 包名 | 3.8 版本 | 4.14 版本 |
|------|---------|----------|
| @grammyjs/types | ^3.25.0 | ^3.26.0 |
| @types/node | ^25.3.5 | 25.6.0 |
| @typescript/native-preview | 7.0.0-dev.20260307.1 | 7.0.0-dev.20260412.1 |
| @vitest/coverage-v8 | ^4.0.18 | ^4.1.4 |
| jscpd | 4.0.8 | 4.0.9 |
| lit | ^3.3.2 | ^3.3.2 |
| oxfmt | 0.36.0 | 0.44.0 |
| oxlint | ^1.51.0 | ^1.59.0 |
| oxlint-tsgolint | ^0.16.0 | ^0.20.0 |
| signal-utils | 0.21.1 | 0.21.1 |
| tsdown | 0.21.0 | 0.21.7 |
| tsx | ^4.21.0 | ^4.21.0 |
| typescript | ^5.9.3 | ^6.0.2 |
| vitest | ^4.0.18 | ^4.1.4 |

### 1.3 需要新增的 dependencies
- @anthropic-ai/vertex-sdk: ^0.15.0
- @aws-sdk/client-bedrock-runtime: 3.1028.0
- @aws-sdk/credential-provider-node: 3.972.30
- @aws/bedrock-token-generator: ^1.1.0
- @google/genai: ^1.49.0
- @lancedb/lancedb: ^0.27.2
- @larksuiteoapi/node-sdk: ^1.60.0
- @modelcontextprotocol/sdk: 1.29.0
- @tloncorp/api: (optional)
- @tloncorp/tlon-skill: (optional)
- @discordjs/opus: (optional)
- @matrix-org/matrix-sdk-crypto-wasm: 18.0.0
- @matrix-org/matrix-sdk-crypto-nodejs: ^0.4.0 (optional)
- axios: 1.15.0 (override)
- fake-indexeddb: ^6.2.5 (optional)
- gaxios: 7.1.4
- google-auth-library: ^10.6.2
- hono: 4.12.12
- jimp: ^1.6.1
- long: ^5.3.2
- matrix-js-sdk: 41.3.0
- mpg123-decoder: ^1.0.3
- music-metadata: ^11.12.3 (optional)
- nostr-tools: ^2.23.3
- openai: ^6.34.0
- openshell: 0.1.0 (optional)
- proxy-agent: ^8.0.1
- silk-wasm: ^3.7.1
- uuid: ^13.0.0
- yauzl: 3.2.1 (override)

### 1.4 需要新增的 devDependencies
- jsdom: ^29.0.2
- madge: ^8.0.0
- semver: 7.7.4

### 1.5 需要更新 peerDependencies
- node-llama-cpp: 3.16.2 → 3.18.1

### 1.6 engines 更新
- node: >=22.12.0 → >=22.14.0

### 1.7 packageManager 更新
- pnpm: 10.23.0 → 10.32.1

### 1.8 pnpm 配置更新
- 合并 overrides 配置
- 添加 overrides.axios
- 添加 overrides.@anthropic-ai/sdk
- 添加 overrides.hono
- 添加 overrides.@hono/node-server
- 添加 overrides.defu
- 添加 overrides.fast-xml-parser
- 添加 overrides.basic-ftp
- 添加 overrides.file-type
- 添加 overrides.path-to-regexp
- 添加 overrides.yauzl
- 移除 minimumReleaseAge
- 更新 onlyBuiltDependencies

## 2. 保留 PaleoClaw 特有的部分

- name: paleoclaw (不变)
- description: "An AI Research Agent for Paleontology..." (不变)
- bin: paleoclaw.mjs (不变)
- scripts 中的 paleoclaw 相关命令 (保留)
- PaleoClaw 特有的 skills/ 目录
- PaleoClaw 特有的 src/paleoclaw/ 目录
- soul.md, user.md, PALEOCLAW_IDENTITY.md 等身份文件
- PaleoClaw 特有的 AGENTS.md, VISION.md 等文档

## 3. 逐步执行步骤

1. 备份当前 package.json
2. 更新 dependencies 版本
3. 更新 devDependencies 版本
4. 添加新的 dependencies
5. 添加新的 devDependencies
6. 更新 peerDependencies
7. 更新 engines
8. 更新 packageManager
9. 更新 pnpm 配置
10. 保留 PaleoClaw 特有的 scripts
11. 运行 pnpm install 验证

## 4. 风险评估

- 中等风险：大量依赖版本升级可能引入 breaking changes
- 低风险：scripts 变化较大，但 PaleoClaw 特有的命令已保留
- 低风险：exports 新增大量模块，当前 PaleoClaw 可能不需要这些

## 5. 验证步骤

1. pnpm install 成功
2. pnpm build 成功
3. pnpm paleoclaw --version 输出正确
4. PaleoClaw 特有的命令可用
