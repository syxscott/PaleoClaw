# PaleoClaw 代码审查报告

**审查日期**: 2026-10-19
**审查范围**: `feat/channels-qq-wecom-wechat` 相对 `main` 的全部改动（97 个文件）
**审查方式**: `@senior-fullstack-developer:engineering-workflow` + 宿主 `code-review` Skill + 6 组并行子 agent（按模块排他范围）+ TypeScript AST 机械扫描 + 实测复现
**审查结论**: ❌ **不通过** —— 2 个 CRITICAL、8 个 HIGH、23 个 MEDIUM、6 个 LOW 代码缺陷，另有 8 项架构/文档缺口

---

## ✅ 修复状态（2026-10-20 已全部修复）

全部 47 项发现均已修复并验证。修复分 7 组并行推进（按文件归属排他切分），每组均附**修复前反证**（回滚源码保留新测试 → 断言变红）。

| 分组       | 覆盖缺陷              | 关键改动                                                                                                                                           | 测试                                                   |
| ---------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 构建接线   | C1、H6、A8            | plugin-sdk 子路径补进**全部 7 份清单**（exports / tsdown / tsconfig.dts / write-plugin-sdk-entry-dts / plugins-loader alias / CI 守卫 / vitest）   | 守卫 `OK: All 21 required plugin-sdk exports verified` |
| 微信插件   | C2、H7、H8、M5–M8、L6 | 接入控制改用规范 helper；`stop()` 可中断；错误不再被吞；改走 `fetchWithSsrFGuard`；通配符 `*` 生效；命名账号不再串号；代理对安全                   | 8 文件 / 83 例                                         |
| 企业微信   | H2、H3、M9–M13、L3–L5 | deliver 路径强制 allowlist + 配对码；账号维度回调路径；CDATA 安全 XML；errcode 严格校验；按**字节**截断 + chunker；token 共享缓存；群聊不再当私聊  | 6 文件 / 72 例                                         |
| QQ 插件    | H4、H5、M1–M4、L1、L2 | pairing 流程接线 + 修正 approveHint；凭据指纹化缓存；连接超时关 socket 并排重连；附件投递给 agent；群聊媒体契约对齐；accountId 透传                | 12 文件 / 109 例                                       |
| 记忆子系统 | H1、M14–M19           | 记忆按 session 隔离（跨会话泄漏已复现并修复）；日期固定夹具；`listChatDaily` 语义统一；缓存键测试改为真断言；保留期清理；跨进程锁；计数口径统一    | 6 文件 / 37 例                                         |
| 会话/工具  | M20–M23               | `busy_timeout` + `BEGIN IMMEDIATE` + 全事务重试；标题回归测试改为真守卫；属名缩写不再被切开；注释与实现对齐                                        | 7 文件 / 68 例                                         |
| 文档与约定 | A1–A7                 | labeler 补 3 个插件；新建 3 个渠道文档页；渠道索引 / subpath 清单 / README / README_CN / CHANGELOG 全部补齐；`PaleoClaw_AGENTS.md` 按真实 API 重写 | —                                                      |

**主审额外收尾**（各 worker 权限之外）：

- `src/paleoclaw/cli/memory-cli.ts` —— 修复 H1 带来的 CLI 行为回归：`paleo-memory search` 新增 `--session` / `--all-sessions`，`context` 新增 `--session`。
- `extensions/wecom/src/qyapi.ts` —— 修复 H5 的企业微信同类残留：token 缓存键加入凭据指纹，轮换 `corpId`/`secret` 不再复用旧 token。
- `src/paleoclaw/paths.ts` —— 抽出共享的 `withFileLock()` 原语，记忆存储与 JSON 会话存储共用，消掉 JSON store 的读-改-写丢消息竞态。
- `docs/docs.json` —— 导航补录三个新渠道页（否则文档存在但不在导航里）。
- `CONTRIBUTING_CN.md` —— 修正 `pnpm test --filter`（Vitest 无此参数）为 `pnpm test -- <pattern>`。
- `extensions/weixin/src/{channel,monitor,outbound}.ts` —— 修掉本次引入的**弱随机回归**：`Date.now()` 与 `Math.random()` 同行生成 clientId，违反仓库守卫，改用 `crypto.randomUUID()`。

**终局验证**：

| 检查                                              | 结果                                                                                                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsdown` 构建                                     | ✅ exit 0                                                                                                                                                      |
| Node 真实解析 `paleoclaw/plugin-sdk/qqbot`        | ✅ **RESOLVE_OK**（修复前为 `MODULE_NOT_FOUND`）                                                                                                               |
| `dist/plugin-sdk/{qqbot,wecom,weixin}.{js,d.ts}`  | ✅ 全部生成                                                                                                                                                    |
| `scripts/check-plugin-sdk-exports.mjs`（CI 守卫） | ✅ exit 0，21 项导出全过                                                                                                                                       |
| 扩展测试全套                                      | ✅ **292 文件 / 2575 用例通过**（1 跳过）                                                                                                                      |
| 单元测试全套                                      | ✅ **888 文件 / 7337 用例通过**；仅 3 个文件 4 用例失败，均为环境问题（bash 钩子集成、Windows 中文区域 `Intl` 输出「周一」、macOS Xcode 脚本），与本次改动无关 |
| `tsc --noEmit`（全仓）                            | ✅ exit 0                                                                                                                                                      |
| `oxlint --type-aware`                             | ✅ exit 0                                                                                                                                                      |
| `oxfmt --check`                                   | ✅ 全部合规                                                                                                                                                    |
| 仓库守卫脚本（6 个）                              | ✅ 全部 exit 0                                                                                                                                                 |
| AST 空函数重扫（61 个改动文件）                   | ✅ **具名空函数 0**；2 处命中均为既有且合法（JSON store 的接口可选 no-op `close()`、微信的后期绑定 `signalStop` 默认值）                                       |

> 附带修复：微信插件引入的弱随机曾导致 `src/security/temp-path-guard.test.ts` 变红——这是本轮唯一由本次改动引入的测试回归，已在终局验证前修掉并复验通过。

---

## 📋 执行摘要

| 维度             | 结论                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **有没有 bug**   | 有。39 个可行动缺陷，其中 2 个 CRITICAL 会让新增功能在生产中完全不可用                                                          |
| **架构是否完整** | 不完整。plugin-sdk 子路径涉及 **5 份清单**，本分支只改了 2 份，导致发布产物缺失；三个新渠道的接入控制未按既有模式实现           |
| **有没有空函数** | **没有**。97 个改动文件中具名空函数 = 0，空实现 = 0，no-op 返回 = 0，0 个 `@ts-nocheck`。7 个匿名空回调经逐个确认全部为有意为之 |
| **测试是否可信** | 203 个新插件用例 + 96 个核心用例全绿，但**全绿掩盖了 CRITICAL 缺陷**（vitest 别名直连源码，绕过构建产物）                       |

### 关键风险提示

- 三个新渠道（QQ / 企业微信 / 微信）**共享同一类架构缺陷**：接入控制未按仓库既有模式实现，其中微信渠道**默认配置下对任意发送者开放**。
- 本分支新增的 3 个回归测试中，**有 2 个在修复前同样通过**（即没有真正守住它们声称防住的回归）。

---

## 🔴 CRITICAL

### C1. QQ 渠道插件在发布产物中完全无法加载

- **File**: `tsdown.config.ts:43-90`、`tsconfig.plugin-sdk.dts.json:13-61`、`package.json:174-177`、`src/plugins/loader.ts:114-202`
- **Trigger**: 构建/安装 `paleoclaw` 后启用 QQ 渠道。`extensions/qqbot` 的 6 个文件从 `paleoclaw/plugin-sdk/qqbot` 导入（其中 `index.ts:2`、`src/accounts.ts:1`、`src/monitor.ts:8` 是**值导入**），而 `package.json` 的 exports 把该子路径指向 `./dist/plugin-sdk/qqbot.js`。
- **Impact**: 该文件**从不存在**。实测 Node 真实解析器：
  ```
  paleoclaw/plugin-sdk/qqbot   → MODULE_NOT_FOUND: Cannot find module '...\dist\plugin-sdk\qqbot.js'
  paleoclaw/plugin-sdk/wecom   → RESOLVE_OK
  paleoclaw/plugin-sdk/weixin  → RESOLVE_OK
  ```
  QQ 渠道在**任何构建产物中都是死的**。现有 `dist/plugin-sdk/` 有 `wecom.js`(47KB)/`weixin.js`(43KB) 而无 `qqbot.js`，且该 dist 构建于 `src/plugin-sdk/qqbot.ts` 创建之后 29 分钟——本分支自己的构建就没产出它。
- **根因**: 同一份「plugin-sdk 子路径清单」在仓库里存在 **5 处**，本分支只改了 2 处：

  | 清单                                                  | 作用                     | qqbot | wecom | weixin |
  | ----------------------------------------------------- | ------------------------ | ----- | ----- | ------ |
  | `package.json` exports                                | 对外发布契约             | ✅    | ✅    | ✅     |
  | `tsdown.config.ts` `pluginSdkEntrypoints`             | 构建 .js 产物            | ❌    | ✅    | ✅     |
  | `tsconfig.plugin-sdk.dts.json` `include`              | 生成 .d.ts               | ❌    | ✅    | ✅     |
  | `scripts/write-plugin-sdk-entry-dts.ts:9-54`          | 稳定顶层 .d.ts 入口      | ❌    | ❌    | ❌     |
  | `src/plugins/loader.ts` `pluginSdkScopedAliasEntries` | 运行时 jiti alias        | ❌    | ❌    | ❌     |
  | `vitest.config.ts` `pluginSdkSubpaths`                | **测试别名（掩盖问题）** | ✅    | ✅    | ✅     |

  `vitest.config.ts` 恰好把 `qqbot` 别名指向 **源码** `src/plugin-sdk/qqbot.ts`，所以 203 个测试全绿也测不出发布产物缺失。

- **CI 为何没拦住**: `scripts/check-plugin-sdk-exports.mjs:44-88` 的 `requiredSubpathEntries` 只列了 43 个子路径，**不含这三个**，所以该守卫脚本从不检查它们的 .js/.d.ts 产物是否存在。
- **Fix**: 把 `qqbot`/`wecom`/`weixin` 补进上述 5 份清单，并把三个新子路径加入 `check-plugin-sdk-exports.mjs` 的 `requiredSubpathEntries`（否则同类问题会再次发生）。

### C2. 微信渠道默认配置下对任意发送者开放

- **File**: `extensions/weixin/src/monitor.ts:205-214`、`extensions/weixin/src/accounts.ts:79`
- **Trigger**: 默认配置（未设 `dmPolicy` → `accounts.ts:79` 解析为 `"pairing"`）。任意陌生用户给机器人发一条微信消息。
- **Impact**: `isDmIntakeAllowed()` 在 `dmPolicy === "pairing"` 时**直接 `return true`**，注释写「pairing gate runs later in the gateway」——**这个注释是错的**：`src/auto-reply/reply/dispatch-from-config.ts` 中 `pairing|allowFrom|isSenderAllowed|authorized|dmPolicy` **零命中**。仓库的接入控制是**按渠道 monitor 各自实现**的（`src/security/dm-policy-shared.ts` 的 `readStoreAllowFromForDmPolicy` / `resolveDmGroupAccessWithLists` 被 web、discord、signal、slack、imessage、bluebubbles、nextcloud-talk、mattermost、irc、msteams、matrix、googlechat 共 12 处使用），**三个新插件一个都没用**。结果：默认配置下任何人发消息都能触发 agent 及其全部工具，且从不发起配对码挑战，用户永远无法被质询。
- **Fix**: 在 `monitor.ts` 中对 `dmPolicy === "pairing"` 调用共享的配对挑战路径（同 telegram 做法）并返回 `false`，直到发送者被放行或完成配对。

---

## 🟠 HIGH

### H1. 记忆跨会话泄漏：任一会话的对话原文被注入另一会话的提示词

- **File**: `src/paleoclaw/memory/manager.ts:58-63`（配合 `store.ts:906`）
- **Trigger**: 同一 gateway 上两个不同 session。`BuiltinTaskMemoryProvider` 持有 `this.sessionId`（`manager.ts:34-41`）却**只在 `sync()` 里用**；`prefetch()` 走 `searchMemory({scope:"all"})`，而 `store.ts:906` 的 `listChatDaily(30)` 把所有 session 的 chat 文件全部放进检索语料，**无 session 过滤**。
- **Impact**: **已独立复现**：
  ```
  1. [chat] chat-20261019-session-A (score=0.5791) 我司内部项目代号是 ZEPHYRUS-7，预算 320 万
  是否泄漏会话 A 的内容: ❌ 是
  ```
  A 的私聊内容被当作「召回记忆」写进 B 的提示词（`src/commands/agent.ts:695-698`）并可能回显给 B。入口是 HTTP/WS/频道共用的 `agentCommandFromIngress`，本分支又新增了 QQ/WeCom/WeChat 多用户渠道。此前 `sync()` 是 no-op、chat 文件也未被索引，**这是本分支新引入的可达路径**。
- **Fix**: `searchMemory` 增加 `sessionId` 参数，chat 条目只索引本 session；或 `prefetch` 不用 `scope:"all"` 取 chat。

### H2. 企业微信 allowlist 形同虚设

- **File**: `extensions/wecom/src/channel.ts:243-288`（deliver 路径）
- **Trigger**: 配置 `channels.wecom.dmPolicy="allowlist"`、`allowFrom:["zhangsan"]`；其他成员 "lisi" 给应用发消息。
- **Impact**: 全插件搜索确认，`allowFrom` 只在 `accounts.ts:89` 被解析、在 `channel.ts:151` 被返回给审计路径，**从未用于拦截入站消息**。`deliver` 回调直接 `finalizeInboundContext`（`CommandAuthorized: false` 硬编码）后派发给 agent。后果：`paleoclaw status --all` 与 doctor 安全审计**报告该渠道受限**，运行时却允许任何人；插件自己的告警文案「allowlist with empty allowFrom blocks all senders」（`channel.ts:175-177`）是**假的**。
- **Fix**: 在 `deliver` 中解析有效策略（含 pairing store），未授权发送者在 `finalizeInboundContext` 之前丢弃。

### H3. 企业微信多账号回调路径冲突，第二个账号顶掉第一个

- **File**: `extensions/wecom/src/accounts.ts:86-87`、`extensions/wecom/src/channel.ts:297-313`
- **Trigger**: 配置 `channels.wecom.accounts = {a:{…}, b:{…}}` 且未显式设置 `callbackPath`。
- **Impact**: 默认路径 `DEFAULT_CALLBACK_PATH` **不含 accountId**（`accounts.ts:86-87`），两个账号解析到同一路径；`channel.ts:307` 以 `replaceExisting: true` 注册 → 后注册者**静默替换**前者的 handler。账号 A 的回调 URL 命中 B 的 handler → 用 B 的密钥验签 → 每条消息都 HTTP 400，A 彻底失效。`activeRouteUnregisters` 的键是 `${accountId}:${path}`，陈旧路由清理逻辑检测不到该冲突。
- **Fix**: 默认路径改为账号维度（`/wecom/callback/<accountId>`），或拒绝注册已被其他账号占用的路径。

### H4. QQ 的 `dmPolicy: "pairing"` 是死策略

- **File**: `extensions/qqbot/src/accounts.ts:105`（默认）、`:145-149`（判定）、`channel.ts:129`（approveHint）
- **Trigger**: 默认配置 `dmPolicy` 解析为 `"pairing"`（`accounts.ts:105`）。
- **Impact**: 代码里留着自认的注释：
  ```ts
  if (account.dmPolicy === "pairing") {
    // Pairing flow is not wired yet; treat as allowlist (empty list = blocked)
    // so an unconfigured deployment stays closed. Documented in the README.
  ```
  三重问题：① 全插件搜索 `upsertPairingRequest`/`readStoreAllowFromForDmPolicy` **零命中**，配对流程从未接线；② `channel.ts:129` 的 `approveHint: "paleoclaw pairing approve qqbot <openid>"` 把用户导向一个**永远失败**的命令（无待处理请求），且参数形态也错（irc 的实现用 `readStoreAllowFromForDmPolicy` 读 store，qqbot 从不读）；③ 注释声称「Documented in the README」，但 **README 零提及 QQ 机器人**。
  注：此策略**闭锁**（fail-closed），故列 HIGH 而非 CRITICAL。
- **Fix**: 接入 `createScopedPairingAccess` + `readStoreAllowFromForDmPolicy`，拒绝时 `upsertPairingRequest` 并回复配对码；或从枚举/默认值中移除 `pairing` 并修正 approveHint。

### H5. QQ 账号上下文缓存钉死旧凭据

- **File**: `extensions/qqbot/src/send.ts:144-154`
- **Trigger**: 轮换 `channels.qqbot.appSecret`（或切换 `sandbox: true`），配置热重载重启账号。
- **Impact**: 缓存**只按 accountId 建键**（`send.ts:147`），命中即返回旧 context，其 `tokenManager` 与 `client` 仍持有旧 secret / 旧 `apiBase`。`clearQqbotAccountContexts()`（`send.ts:157`）**全仓库无调用点**。旧 token 过期（≤2h）后每次刷新 401 → `sendIdentify` 失败 → close 4004 → invalidate → 重试 → 100 次后账号静默死亡，直到进程重启。
- **Fix**: 缓存键加入凭据哈希（或在 `channels.qqbot` 重载时失效），凭据变化时重建 token manager 与 client。

### H6. plugin-sdk 新增子路径的类型声明入口未生成

- **File**: `package.json:174-177`、`:210-217`、`scripts/write-plugin-sdk-entry-dts.ts:9-54`
- **Trigger**: TypeScript 消费方以 `moduleResolution: nodenext/bundler` 解析 `paleoclaw/plugin-sdk/wecom`。
- **Impact**: `package.json` 声明 `"types": "./dist/plugin-sdk/wecom.d.ts"`，但该文件**不会生成**——`write-plugin-sdk-entry-dts.ts` 的 `entrypoints` 硬编码列表没有这三个名字（`tsc` 实际把它们吐在 `dist/plugin-sdk/plugin-sdk/<name>.d.ts`，顶层稳定入口只由该脚本生成）。→ 消费方得到 **TS2307**。`scripts/release-check.ts` 同样缺这三个条目。
- **Fix**: 把 `qqbot`/`wecom`/`weixin` 加入 `write-plugin-sdk-entry-dts.ts` 的 `entrypoints` 与 `release-check.ts` 的清单。

### H7. 微信 `stop()` 最多阻塞 10 分钟

- **File**: `extensions/weixin/src/monitor.ts:117-122`（sleep）、`:88-94`（stop）
- **Trigger**: 上游返回一次 `ret=-14` → 循环进入 `await sleep(SESSION_EXPIRED_PAUSE_MS)`（600 000 ms），该 sleep **不可被 `this.running=false` 中断**；`stop()` 随后 `await this.pollPromise`。
- **Impact**: 实测 `stop()` 3 秒后仍未返回（实际会阻塞约 600 秒）。`channel.ts:289-292` 在 abort handler 里 `await monitor.stop()` → **gateway 停机/重启每个账号卡 10 分钟**；30 秒退避 sleep 同理。
- **Fix**: 用 abort/stop promise 与 sleep 竞速（或按 ≤1 秒切片轮询停止标志）。

### H8. 微信网络/HTTP 错误被吞，频道静默死亡

- **File**: `extensions/weixin/src/ilink.ts:195-198`
- **Trigger**: token 失效上游返回 HTTP 401，或网络中断。`ilinkPost` 抛错，`getUpdates` 的 catch-all 吞掉一切并返回 `{ret:0, errcode:0, msgs:[]}`。
- **Impact**: 实测 HTTP 401 时 `getUpdates` 返回 `{"ret":0,"errcode":0,"msgs":[]}`。monitor 把它当作「健康的空轮询」→ `consecutiveFailures` 归零 → 文档所述「3 次失败 → 30 秒退避」**永不触发** → 以网络允许的最快速度持续重打上游。运维看不到任何错误，频道显示「已连接」但收不到任何消息。
- **Fix**: 区分传输层/HTTP 错误与空轮询，让 `getUpdates` 上抛错误（或返回错误标志）以触发退避与错误日志。

---

## 🟡 MEDIUM（23 项）

### QQ 渠道与微信渠道

| #   | 问题                                                 | 位置                                                                      | 触发 → 影响                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | 连接超时不关 socket、不排重连                        | `extensions/qqbot/src/gateway.ts:168-208`                                 | 握手挂死 → 20s 后 `reject` 但 `this.socket` 未 close、未走 `handleClose` → **无重连**、半开 socket 泄漏；且该 socket 后续若真的连上，`onOpen`/`onMessage` 仍会生效 → **已失败的 start() 之后又开始投递消息**                                                           |
| M2  | 入站附件解析后从不投递给 agent                       | `extensions/qqbot/src/monitor.ts:126-146`                                 | 群里发图 → `normalize` 填了 `message.attachments`，但 `finalizeInboundContext` 没有 `MediaUrl`/`MediaType`/`MediaPaths` → agent 只看到文字，**图片静默丢失**（`capabilities.media: true` 依旧）                                                                        |
| M3  | 群聊媒体：能力宣称支持，代码直接抛                   | `extensions/qqbot/src/send.ts:104`、`media.ts:98` vs `channel.ts:179-180` | 提示词明说「targets 是 `channel_id` (guild)」「Media 经 QQ files API 上传」，实际 guild 路径 `throw` → **整条回复失败**，非仅图片                                                                                                                                      |
| M4  | `resolveAllowFrom`/`resolveDefaultTo` 忽略 accountId | `extensions/qqbot/src/channel.ts:118-121`                                 | 多账号时返回**默认账号**的值 → 工具侧按账号路由失效                                                                                                                                                                                                                    |
| M5  | 新增裸 `fetch()` 调用点，无 SSRF 守卫                | `extensions/weixin/src/ilink.ts:52`                                       | 仓库有 `scripts/check-no-raw-channel-fetch.mjs` 明确要求渠道插件用 `fetchWithSsrFGuard`；weixin 是 27 个调用点中**唯一未进白名单**的 → 运营商/上游返回的 `baseUrl` 会被带 token 无守卫抓取（该守卫脚本当前因 `resolveRepoRoot` 解析到仓库父目录而空转，CI 同样抓不到） |
| M6  | `allowFrom: ["*"]` 反而全拦                          | `extensions/weixin/src/monitor.ts:210-212`                                | 用裸 `.includes` 比对 → 通配符被字面匹配 → **谁都不匹配**。而 `src/channels/plugins/onboarding/helpers.ts:18-21` 的 `addWildcardAllowFrom` 正是 onboarding 流程写进去的 → 标准引导路径可触发                                                                           |
| M7  | 命名账号静默回退到默认账号凭据                       | `extensions/weixin/src/accounts.ts:68-69`                                 | `accounts.personal` 无 token → 落到顶层/`WEIXIN_TOKEN` → **以另一个 bot 的身份收发**，账号隔离失效                                                                                                                                                                     |
| M8  | chunk 切断代理对                                     | `extensions/weixin/src/text.ts:208-210`                                   | 边界落在 emoji 中间 → 产出 `"\ud83d"` 孤立代理项（仓库已有 `sliceUtf16Safe` 助手未用）                                                                                                                                                                                 |

### 企业微信

| #   | 问题                                 | 位置                                      | 触发 → 影响                                                                                                                                                            |
| --- | ------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M9  | 消息体含 `</Content>` 被静默丢弃     | `extensions/wecom/src/xml.ts:81-95`       | CDATA 内的 `</Content>` 使 `indexOf` 落在 CDATA 内部 → 叶子节点判定失败 → **内容为空、无报错**                                                                         |
| M10 | 无数值 `errcode` 的响应被当成功      | `extensions/wecom/src/qyapi.ts:138-147`   | `{}`、`{"errcode":"40001"}`、HTTP 500/401 全部 `ok=true` → `messageId:""` 假装已送达，**用户收不到回复也无错误日志**                                                   |
| M11 | 按字符截断但限制是字节，且无 chunker | `extensions/wecom/src/qyapi.ts:36-38`     | 1000 个汉字 = 3000 字节 > WeCom 的 2048 **字节**上限 → 服务端静默截掉 2/3；且声明了 `textChunkLimit: 2048` 却**无 `chunker`**，5000 字回复只投递 2048 字，**尾部丢失** |
| M12 | access token 缓存从未使用            | `extensions/wecom/src/qyapi.ts:127`       | 每次调用新建 manager → 每条消息一次 `gettoken` → 延迟与限流暴露，并可能使并发中的 token 失效                                                                           |
| M13 | 群聊回调被当私聊处理                 | `extensions/wecom/src/normalize.ts:18-49` | 从不读 `ChatType`，硬编码 `"direct"` → 群消息回复到**发送者个人**，且群会话被并入该用户的私聊 session key                                                              |

### 记忆子系统

| #   | 问题                                       | 位置                                                  | 触发 → 影响                                                                                                                                               |
| --- | ------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M14 | 回归测试随日期变化，2027-10-26 当天必失败  | `src/paleoclaw/memory/regressions.test.ts:65-92`      | 断言依赖 FNV 哈希布局，`hash("short")` 与 `hash("20271026")` 撞桶且同号 → 余弦 0.1857 ≥ 阈值 → **CI 在该日必红**                                          |
| M15 | `listChatDaily(30)` 是文件数上限不是 30 天 | `src/paleoclaw/memory/store.ts:906`                   | 实现是 `if (rows.length >= limit) break` → 实测 40 文件跨 2 天时返回 40 → **记忆召回窗口按会话数而非时间收缩**                                            |
| M16 | 「维度化缓存键」回归测试是同义反复         | `src/paleoclaw/memory/regressions.test.ts:177-184`    | 断言只调 `calculateSimilarity`，而 dim 被硬编码为 384 → **修复前后都通过**，声称守护的修复无测试证据                                                      |
| M17 | chat day 文件永不归档、无清理入口          | `src/paleoclaw/memory/store.ts:811`                   | 每轮写一个 `chat-*.json`，`archiveShort` 明确排除 chat，`paleo-memory` 无 delete/purge → **对话内容在磁盘无限累积且用户看不到也删不掉**                   |
| M18 | `recordChatTurn` 是读-改-写                | `src/paleoclaw/memory/store.ts:470-479`               | 两个进程写同一 (day, sessionId) → 后写者基于陈旧读覆盖 → **一轮对话静默消失**                                                                             |
| M19 | `countShort()`/`listShort()` 口径漂移      | `src/paleoclaw/memory/store.ts:952-958` vs `:700-728` | 一个非任务形状的 `.json` → `countShort()=1` 但 `listShort()=[]` → `paleo-memory status` 与 `paleo-memory short` 数字对不上（且该计数会进 agent 系统提示） |

### 会话与工具子系统

| #   | 问题                                 | 位置                                                        | 触发 → 影响                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M20 | seq 冲突重试永不触发，并发写仍丢消息 | `src/paleoclaw/session/store-sqlite.ts:477-500`、`:135-157` | 报错是 `database is locked`（SQLITE_BUSY），**不匹配** `/UNIQUE\|PRIMARY KEY\|constraint/i` → 直接 throw；且无 `busy_timeout` → 调用方 `agent.ts:719` 是空 catch → **消息静默不入库**。实测：加 `busy_timeout=5000` 时等待 1.1s 写入成功。注：main 上同样暴露（既有缺陷），但**本分支新增的重试与注释断言与事实相反** |
| M21 | 新会话回归测试在 main 上也全绿       | `src/paleoclaw/session/regressions.test.ts:1-129`           | 把 `agent.ts:713` 改回传标题（原 bug）→ **15 条断言仍全通过** → 「两段式标题已死」的回归可原样复活                                                                                                                                                                                                                    |
| M22 | 缩写表漏掉古生物最常见的属名缩写     | `src/paleoclaw/tools/literature-summary.ts:18-35`           | `"T. rex is represented. It lived in the Late Cretaceous."` → 切成 `["T.", "rex is represented.", ...]` → 挤掉一条真实句子（`G. iguanodon`、`sp. nov.` 同类）→ **该工具的核心输入域**                                                                                                                                 |
| M23 | Stage-2 会话标题升级在产品中不可达   | `src/commands/agent.ts:653-662`、`:704-713`                 | `createSessionStore()` 从不传 `titleUpgrader`，`store.ts:194-197` 立即返回；全 `src/` 无生产调用方传该参数 → `titleSource` 永不变成 `"llm"`，而本分支注释声称启用了它 → **注释与事实相反**                                                                                                                            |

---

## 🔵 LOW（6 项）

| #   | 问题                                                   | 位置                                                             |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| L1  | probe 返回未脱敏的 `appId`，而另外两处刻意掩码         | `extensions/qqbot/src/probe.ts:29,35,40` vs `channel.ts:111,237` |
| L2  | 群聊私聊回复打到 v2 c2c 端点（用 guild_id）            | `extensions/qqbot/src/normalize.ts:161` + `outbound.ts:105`      |
| L3  | UTF-16 切片可切断代理对                                | `extensions/wecom/src/qyapi.ts:36`                               |
| L4  | 回调无时间戳窗口（重放可用）                           | `extensions/wecom/src/callback.ts:95-97,137-147`                 |
| L5  | 非静默 WeCom 事件会触发 agent 会话                     | `extensions/wecom/src/normalize.ts:36-50`                        |
| L6  | 微信 `allowFrom` 未查 pairing store，`/allow` 批准无效 | `extensions/weixin/src/monitor.ts:210-212`                       |

---

## 🏗️ 架构与文档完整性（8 项）

这一节直接回答「整体结构架构内容是否完整」。

| #   | 缺口                                                           | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **`.github/labeler.yml` 未收录三个插件**                       | AGENTS.md 明文要求「新增 channel 必须更新 labeler.yml 并创建对应 GitHub label」；该文件已覆盖 21 个渠道扩展（bluebubbles…zalouser），**唯独缺 qqbot/wecom/weixin**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| A2  | **`docs/channels/` 无三个渠道文档，但插件却声明了 `docsPath`** | `extensions/{qqbot,wecom,weixin}/package.json` 均声明 `"docsPath": "/channels/xxx"`、`"docsLabel": "xxx"`，而 `docs/channels/` 下**三个文件都不存在** → UI 产生**死链**。zalo 的先例（docsPath + 文档文件同时存在）证明这是约定                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| A3  | `docs/channels/index.md` 渠道清单未更新                        | 该文件逐条列出 24 个渠道，三个新渠道缺失                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| A4  | `docs/tools/plugin.md:161-178` 的 plugin-sdk 子路径清单未更新  | 该段枚举「bundled extension-specific subpaths」，三个新子路径缺失                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| A5  | README / README_CN **完全未提及**新渠道                        | grep `QQ\|WeCom\|WeChat\|微信\|企业微信` 在两份 README 中零命中；渠道三选一都没写                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| A6  | **无 CHANGELOG 条目**                                          | 本分支新增 3 个用户可见渠道，`git diff main...HEAD --name-only` 中**没有 CHANGELOG.md**；仓库也无 `[Unreleased]` 段。AGENTS.md 要求用户可见变更必须写 changelog                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| A7  | `PaleoClaw_AGENTS.md` 的 API 文档与实现全面漂移                | 文档写 `loadProfileLayers()` / `createProfileContext()` / `new MemoryStore()` / `saveShortTermMemory()` / `searchLongTerm()` —— **这 5 个符号一个都不存在**。实际是 `loadSessionProfile()`（`layers.ts:554`）、`buildProfileContextBlock()`（`layers.ts:652`）、`TaskMemoryStore`（`store.ts:230`）、`startTask/finishTask/recordChatTurn/autoReviewToLong`（`store.ts:404-641`）、`searchMemory()`（`store.ts:878`）。文档的「Project Structure」只列 3 个子目录，实际有 6 个（profile/memory/tools/session/integration/paths）。另：文档称 skill 需 `SKILL.md + skill.ts`，但 5 个文档化 skill 中 4 个只有 `SKILL.md`（仅 morphometric_analysis 有 `index.ts`） |
| A8  | `src/plugin-sdk/subpaths.test.ts` 守卫测试未收录新插件         | 该文件专门验证「bundled extension subpaths 可解析」（27 个子路径），**不含** qqbot/wecom/weixin → 即使 C1 的清单漏项也不会被它捕获                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## 🔍 空函数专项结论

针对「有没有空函数」，用 **TypeScript 编译器 API 做 AST 扫描**（非正则）覆盖全部 97 个改动文件：

| 检查项                                                               | 结果                           |
| -------------------------------------------------------------------- | ------------------------------ |
| 具名空函数（函数声明/方法/构造器/访问器，函数体 0 条语句）           | **0**                          |
| 空实现（函数体只有 `return;` 或 `return undefined;`）                | **0**                          |
| 抛异常占位（`not implemented` / `unimplemented` / `TODO` / `FIXME`） | 2 处，均为**有意的契约守卫**   |
| `@ts-nocheck`                                                        | **0**                          |
| 匿名空回调                                                           | 7 处，**逐个确认全部有意为之** |

**7 处匿名空回调逐条说明**：

| 位置                                              | 内容                                                          | 判定                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/web/login.ts:37`、`:72`                      | `Promise.resolve(sock.ws?.close()).catch(() => {})`           | ✅ Baileys `WebSocketClient.close(): void` 返回 void，**根本不产生 Promise** → 不可能有 unhandled rejection，包装本身是惰性的 |
| `src/web/login-qr.ts:43`                          | 同上                                                          | ✅ 同上                                                                                                                       |
| `src/web/inbound/monitor.ts:484`                  | 同上                                                          | ✅ 同上                                                                                                                       |
| `src/paleoclaw/session/store-sqlite.ts:362`       | 标题升级的 best-effort catch，**带解释性注释**                | ✅ 有意为之                                                                                                                   |
| `extensions/qqbot/src/media.ts:98`、`send.ts:104` | 「Guild media send is not supported by the QQ v2 upload API」 | ✅ 有意的守卫，抛出发生在任何副作用之前；**但存在对外契约漂移**（已记为 M3）                                                  |

> 全仓库（5863 个源文件）范围内扫描会有 1193 处「空函数」命中，但绝大多数是测试 mock（`vi.fn()`）与 `.catch(() => {})`，无实际意义，故未列入。收敛到本分支改动范围后才有意义——**结论是干净的**。

---

## ✅ 已验证干净的部分

避免只报问题不报好消息，以下经实测确认无缺陷：

- **QQ token 管理**：singleflight / TTL / 60s 安全边界 / `invalidate()` 语义正确，无刷新竞态；token 从不出现在任何日志或错误文本中（`Authorization` 不在 `QqbotApiError`/`QqbotTokenError` 文本里）。
- **QQ 无 SSRF**：用户 URL 交给 QQ 侧抓取，服务端只 PUT 到 QQ 自己签发的 COS 预签名地址。
- **企业微信 crypto**：先验签后解密、恒定时间比较、32 字节 PKCS#7 逐字节校验、`receive_id` 校验——篡改/截断/错 receive_id 全部拒绝（实测）。
- **企业微信 XML 无 XXE**：无自定义实体展开，无 billion-laughs；越界数值实体抛 RangeError 被捕获返回 400。
- **企业微信 dedup**：有 TTL + `MAX_ENTRIES` 上限。
- **SQL 注入**：session 子系统全部参数化，无字符串拼接。
- **sessionId 校验**：`/`、`\`、`..` 均拒绝，且不参与路径拼接。
- **`meta` 合并**：实测 `{tags, pinned, note}` 全部保留，未丢键。
- **createSessionStore 可抛**：实测 `file is not a database` 会抛出，`agent.ts:644` 与 `session-cli.ts:50` 均已捕获，无裸调用方。
- **`src/web/auto-reply/mentions.ts` 品牌正则改写**：是**真修复**（旧代码拿已归一化的文本去匹配 `/\bopenclaw\b/i`，永不命中）；`literal source.replace` 无灾难性回溯风险。
- **`scripts/test-parallel.mjs` lane 回退**：正确（`maxWorkersForRun` 优先 `OPENCLAW_TEST_WORKERS`，CI 在 ci.yml:182,383 设为 1）。
- **compaction-safeguard.test.ts 未被削弱**：stub 与生产 API `ctx.modelRegistry.getApiKeyAndHeaders(model)` 一致，`toHaveBeenCalledWith`/`not.toHaveBeenCalled()` 断言保留。
- **`summarizePromptAsTitle`** 移除后无悬挂引用。
- **workspace 接线**：`pnpm-workspace.yaml` 的 `extensions/*` 已覆盖三个新插件；无 `workspace:*` 进入 `dependencies`。
- **版本号同步正确**：仓库身份文件停在 v1.6.0，本分支追平到 v1.8.0，与 `package.json` 一致（CHANGELOG 显示 1.7.0 / 1.8.0 均已发布，属**正确追平**而非缺陷）。
- **`isAutoToolsEnabled` / `isMemoryContextEnabled` / `isSessionAutosaveEnabled`**：初看像死代码，实际 `src/commands/agent.ts:664-666` 正确读取并在 `:682/:693/:704` 分支生效；`PALEOCLAW_ENABLE_SKILL_CURATOR` 亦由 `src/skills/curator.ts:59` 消费。（此条为**已排除的疑似项**。）

---

## 🧪 本次执行的验证

| 检查                | 命令 / 方式                                                                                           | 结果                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 三个新插件测试      | `vitest run --config vitest.extensions.config.ts extensions/qqbot extensions/wecom extensions/weixin` | ✅ 18 文件 / **203 用例全绿**                                          |
| PaleoClaw 核心测试  | `vitest run --config vitest.unit.config.ts src/paleoclaw`                                             | ✅ 15 文件 / **96 用例全绿**                                           |
| 会话子集测试        | `vitest run src/paleoclaw/session`                                                                    | ✅ 3 文件 / 41 用例全绿                                                |
| 空函数 AST 扫描     | 自写 TypeScript 编译器 API 脚本，覆盖 97 个改动文件                                                   | 具名空函数 0、no-op 0、`@ts-nocheck` 0                                 |
| 跨会话泄漏复现      | `tsx` 脚本，真实 `TaskMemoryStore` + `BuiltinTaskMemoryProvider`                                      | ❌ **已复现泄漏**                                                      |
| plugin-sdk 解析验证 | Node `createRequire().resolve()` 走真实 exports 映射                                                  | ❌ `qqbot` → MODULE_NOT_FOUND；`wecom`/`weixin`/`zalo`/`telegram` 正常 |
| CI 守卫核对         | 读 `scripts/check-plugin-sdk-exports.mjs`、`scripts/write-plugin-sdk-entry-dts.ts`                    | 确认 5 份清单中 3 份漏项                                               |
| 接入控制核对        | grep 共享 helper `readStoreAllowFromForDmPolicy` / `resolveDmGroupAccessWithLists` 的使用方           | 12 个既有渠道使用，**3 个新插件全部未使用**                            |

---

## 📌 建议修复顺序

1. **C1**（QQ 插件无法加载）—— 一处补 5 个清单 + 1 个 CI 守卫，改动极小但影响整个渠道
2. **C2 / H2**（默认开放 / allowlist 失效）—— 接入控制是安全边界，涉及微信与企业微信
3. **H1**（跨会话泄漏）—— 隐私问题，且本分支新引入
4. **H3 / H4 / H5**（多账号冲突、pairing 死策略、凭据缓存）
5. **M14 / M20 / M21**（三个会让 CI 误报或掩盖回归的测试/重试问题）
6. **A1–A8**（labeler、文档、CHANGELOG）—— 成本低，但属于仓库明文约定

---

_本报告由 `@senior-fullstack-developer:engineering-workflow` 驱动，6 组子 agent 按模块排他范围并行审查，所有头条结论均经主审亲自复核或实测复现。审查为只读操作，未修改任何被审代码。_
