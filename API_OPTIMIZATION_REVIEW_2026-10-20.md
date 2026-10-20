# PaleoClaw API 调用层优化参考

**日期**: 2026-10-20
**问题**: API 调用部分有哪些优化空间？参考 GitHub 上的 zcode / opencode / DeepSeek Harness / ccswitch
**方法**: 先核实四个参照项目的实际做法，再逐条对照 PaleoClaw 当前代码（全部结论带 `file:line` 证据）

---

## 一、结论摘要

PaleoClaw 的 provider 层**不是自研**，而是外部包 `@mariozechner/pi-ai`，当前锁在 **0.66.1**，而 npm 上已发布到 **0.73.1**（落后 7 个 minor）。这决定了大部分「API 优化」的正确落点。

四个参照项目里,**opencode 的 prompt-cache 审计**和 **DeepSeek Harness 的 provider 声明式配置**最具可操作性。PaleoClaw 当前有三个**已验证的具体缺口**：

| #     | 缺口                                                            | 影响                                                                                                              | 参照                                    |
| ----- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **A** | `openai-completions` 路径**从不设置 `prompt_cache_key`**        | 走 OpenAI 兼容端点的所有 provider（MiniMax / DeepSeek / Moonshot / Mistral / 各类自建网关）**前缀缓存命中率为 0** | opencode #27556                         |
| **B** | 系统提示**没有 stable/dynamic 拆分**，整条 system prompt 一起变 | 动态上下文（env / 时间 / 项目 AGENTS.md）每次变动都会击穿整段缓存；工具定义（最大头，~12k token）本可长期驻留     | opencode PR #20109 + 4-breakpoint 模式  |
| **C** | 缓存能力白名单**硬编码**且不含 minimax                          | 本项目自建部署（provider = `minimax/minimax-cn`）即使开启 `contextPruning.mode="cache-ttl"` 也**静默不生效**      | opencode #25984/#26460 / DSH 自定义路由 |

另有两个中等价值项（流式双看门狗、provider 能力表声明化）和两个长期项（事件流、切换体验）。

**PaleoClaw 已经比参照项目做得好的地方**（不要照抄它们）：

- **认证档位熔断**（`src/agents/auth-profiles/`）：`rate_limit` / `overloaded` / `billing` / `auth` 分级冷却 + 指数升级 + 半开→闭合复位 + 过期窗口清理。opencode 那边只是「429 就降级到 Sonnet」，量级完全不同。
- **模型回退决策**（`src/agents/model-fallback.ts`）：带 `FailoverReason` 推断、冷却期穿透探测、错误分类留痕。

---

## 二、四个参照项目的核实结果

### DeepSeek Harness — `deepseek-ai/deepseek-harness`（MIT，Cordis 架构）

已核实（官网 + GitHub + 掘金/IT之家报道）：

- 定位公式 **Model + Harness = Agent**；模型只是插件，`llm-deepseek`（官方）和 `llm-pi-ai`（通用多provider）两个适配器包。
- **`llm-pi-ai` 的声明式 provider 配置**（最值得借鉴）：
  ```yaml
  llm-pi-ai:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY # 凭据只存环境变量引用，密钥永不进配置文件
        api: openai-completions
        baseURL: https://gateway.example/v1
        models:
          - id: legacy-chat
          - id: vision-preview
            input: [text, image] # 视觉模型必须显式声明模态，否则发图被拒
  ```
  `compat` 块还带 `supportsDeveloperRole` / `maxTokensField` / `thinkingFormat` —— 因为不同 provider 对 reasoning trace 和 role 字段的格式不同。
- **Trajectory**：系统提示、推理过程、工具调用与结果、子 agent 调度、每一次上下文注入，全部写进 **append-only** 会话日志，可按来源追溯 / 恢复 / 分叉 / 搜索 / 回放。
- **模型发现**：OpenAI 兼容端点走 `GET /models`；服务不提供则手动声明。
- 四种运行模式：Standard / **PTC（Programmatic Tool Calling，模型生成 TS 代码编排多轮工具调用）** / Minimal / Creator。
- 前缀缓存优化：宣称多轮仓库编辑场景下 prefix cache 命中率可达 99.93%（此数字来自第三方站点 `deepseekharness.wiki`，非官方，**未经一手核实**）。

### opencode — `sst/opencode`

我找到的是一份**第三方 prompt-cache 审计报告**（`OnlyTerp/prompt-cache-skills` 仓库的 `audits/opencode.md`，审计 commit `a9ef5a0`，日期 2026-05-27）。它逐 provider 给了缓存能力矩阵和形状错误，**信息密度最高**：

| Provider                         | 缓存方式                                                         | 状态                                                               |
| -------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| Anthropic                        | `cache_control: {type:"ephemeral"}`，命中后 input token 降价 90% | ✅ 4-breakpoint + 系统提示拆分                                     |
| OpenRouter                       | 内容级 `cache_control`，1h TTL                                   | ⚠️ 顶层 `prompt_cache_ttl` 被静默忽略（#16848）                    |
| OpenAI (Responses)               | 自动 `promptCacheKey`                                            | ✅（key 是否 session 级需确认）                                    |
| **OpenAI 兼容 → Anthropic 后端** | 发了 OpenAI 形状的 `promptCacheKey`                              | ❌ **0% 命中**（#25984 / #26460）                                  |
| Mistral                          | 无 `prompt_cache_key`                                            | ❌ **无缓存**（#27556）                                            |
| Bedrock                          | Message 级 `cachePoint`                                          | ⚠️ 含 DocumentBlock 时报错「nothing available to cache」（#17300） |
| Vertex (Anthropic)               | 显式支持                                                         | ✅（PR #20266）                                                    |

**核心范式（Anthropic 4-breakpoint）**：
把系统提示拆成两条 message——**稳定段**（provider prompt + 全局 AGENTS.md + 工具定义）与**动态段**（env 信息 + 项目 AGENTS.md + `user.system`）；两段各给一个 `cache_control`，再在最后两条非 system 消息上各加一个 = **4 个，正好是 Anthropic 上限**。
工具定义合计约 12k token 且跨 session 字节级稳定，**是缓存收益的最大单一来源**。

**流式双看门狗**：

- Idle 看门狗：90 秒无事件 → 强制中断并**降级为非流式模式**（45 秒时先发警告）
- Stall 检测：两个 chunk 间隔 > 30 秒 → **只记日志不中断**（模型可能只是在思考）

**错误处理分层**：429 → 降级到 Sonnet，且只对前台请求重试（后台任务直接放弃）；413 / `prompt_too_long` → 捕获后自动 compact 上下文再重试；503 / 502 → 最多重试 10 次、总等待约 2.5 分钟。

### ccswitch

桌面端工具，管 **Claude Code / MiniMax Code 的 provider 配置目录切换**（端点、API Key、模型），带配置目录级自动备份（默认 24h 一次）和手动备份。

可借鉴点不在 API 协议层，而在**运维体验**：切 provider 不重写凭据引用、配置目录备份、切换前预检连通性。

### zcode — ⚠️ 未能确认

按「github zcode AI coding agent harness API」检索，返回的候选（`Bizuayeu/GLM-5.3-Flash-NVFP4-DGX-Sparks-BIZ` 等）均与目标不符。**需要你给出准确的仓库名或组织名**，我再补这一块。

---

## 三、PaleoClaw 现状（带证据）

### 3.1 provider 层是外部包，且落后 7 个 minor

```
package.json → "@mariozechner/pi-ai": "0.66.1"
npm view @mariozechner/pi-ai version → 0.73.1
```

同时依赖 `pi-agent-core` / `pi-coding-agent` / `pi-tui` 同版本。

### 3.2 缓存现状

| 机制                           | 位置                                                                                                                  | 状态                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Anthropic 原生 `cache_control` | pi-ai `anthropic.js:23-33, 469-501, 688-704`                                                                          | ✅ system + 最后一个 user + 1 ≈ **3 个 breakpoint**                                    |
| OpenRouter Anthropic           | pi-ai `openai-completions.js:294` + 仓库 `extra-params.ts:583-634`                                                    | ✅ 仓库补了 pi-ai 缺的 **system breakpoint**（两者互补，不冲突）                       |
| 缓存 TTL 保留                  | 仓库 `extra-params.ts:80-122` + pi-ai `getCacheControl`                                                               | ✅ `cacheRetention: short/long/none`；`ttl:"1h"` 仅当 `baseUrl` 含 `api.anthropic.com` |
| 缓存 token 统计                | `src/agents/usage.ts:16-17, 110-115`                                                                                  | ✅ 读 `cache_read_input_tokens` / `cache_creation_input_tokens` / `cached_tokens`      |
| **`prompt_cache_key`**         | **全仓库零命中**；pi-ai 里只有 `azure-openai-responses.js` / `openai-codex-responses.js` / `openai-responses.js` 设了 | ❌ **`openai-completions.js` 没有**                                                    |

### 3.3 缺口 A —— `openai-completions` 无 `prompt_cache_key`

pi-ai 0.66.1 逐 provider 实测：

```
openai-responses.js        ✅  prompt_cache_key: cacheRetention === "none" ? undefined : options?.sessionId
azure-openai-responses.js  ✅  prompt_cache_key: options?.sessionId
openai-codex-responses.js  ✅  prompt_cache_key: options?.sessionId
openai-completions.js      ❌  无     ← MiniMax / DeepSeek / Moonshot / Mistral / 自建网关走这里
mistral.js                 ❌  无
google.js / google-vertex.js / google-gemini-cli.js  ❌  无（Google 走 CachedContent API）
```

**影响**：凡是走 `openai-completions` 的端点，即使 provider 本身支持前缀缓存，也拿不到 `prompt_cache_key`，路由亲和性无从建立 → 缓存命中率为 0。opencode 的 Mistral 问题（#27556）是同一个根因。

**对自建部署的意义**：本项目自建服务器用的是 `minimax/minimax-cn`，OpenAI 兼容路径。**是否真的 0 命中取决于 MiniMax 是否识别 `prompt_cache_key` —— 这一条需要你实测确认**（见 §五 的验证脚本）。

### 3.4 缺口 B —— 系统提示没有 stable/dynamic 拆分

`src/agents/pi-embedded-runner/run/attempt.ts:1051-1058`：

```ts
const systemPromptOverride = createSystemPromptOverride(appendPrompt);
let systemPromptText = systemPromptOverride();
```

整条系统提示是**一条 message**。工具定义（字节级稳定，收益最大头）与动态上下文（env 信息、当前时间、工作目录、项目 AGENTS.md）混在一起 → 任何动态项变动都会让整段前缀失配。

对照 opencode 的修法（PR #20109）：`user.system` 必须待在**动态段**，早期版本把它并进稳定段，等于每次都让缓存失效。

### 3.5 缺口 C —— 缓存资格白名单硬编码，minimax 被排除

`src/agents/pi-embedded-runner/cache-ttl.ts:11`：

```ts
const CACHE_TTL_NATIVE_PROVIDERS = new Set(["anthropic", "moonshot", "zai"]);
```

外加 `openrouter` 的 `anthropic/ moonshot/ moonshotai/ zai/` 前缀，以及 `kilocode` 的 `anthropic/` 前缀。

门禁点 `src/agents/pi-embedded-runner/extensions.ts:41`：

```ts
if (!isCacheTtlEligibleProvider(params.provider, params.modelId)) {
  return undefined; // ← 静默不生效，没有任何提示
}
```

`src/agents/pi-embedded-runner/run/attempt.ts:1840` 同理，用于决定要不要记录 cache-TTL 时间戳。

**后果**：自建部署 provider = `minimax`，即使配置了 `agents.defaults.contextPruning.mode = "cache-ttl"`，该扩展也**直接 return undefined**——不报错、不告警、用户以为生效了。

**根因与 opencode #25984 同类**：能力判定硬编码在代码里，而不是声明式配置。

### 3.6 已经做对的部分（不要动）

| 能力                    | 位置                                            | 对比                           |
| ----------------------- | ----------------------------------------------- | ------------------------------ |
| 认证档位分级冷却 + 熔断 | `src/agents/auth-profiles/{usage,order}.ts`     | 优于 opencode 的「429 就降级」 |
| 模型回退决策            | `src/agents/model-fallback.ts:452-456, 534-541` | 带冷却期穿透探测与错误分类留痕 |
| 缓存 token 计费统计     | `src/agents/usage.ts:110-115`                   | 兼容多家的字段命名差异         |
| CLI backend 看门狗      | `src/agents/cli-watchdog-defaults.ts`           | 有，但**只覆盖 CLI backend**   |

### 3.7 缺口 D —— 嵌入式 runner 缺流式双看门狗

`cli-watchdog-defaults.ts` 的 `fresh` / `resume` 机制（`noOutputTimeoutMs`、`noOutputTimeoutRatio`、`minMs` / `maxMs`）只作用于 **CLI backend**（codex / claude CLI 这类子进程）。嵌入式 pi runner 走的是 HTTP/SSE 流，**没有等价的 idle / stall 看门狗**。

参照 opencode：

- idle 90s 无事件 → 强制中断并**降级为非流式**（45s 先告警）
- stall（chunk 间隔 > 30s）→ **只记日志不中断**

---

## 四、可借鉴项（按 ROI 排序）

### P0-1 · `openai-completions` 补 `prompt_cache_key`

- **参照**: opencode #27556（Mistral 缺 key → 无缓存）
- **现状**: pi-ai `openai-completions.js` 不设；PaleoClaw 全仓库零命中
- **落点**: `src/agents/pi-embedded-runner/extra-params.ts` —— 已有 `createOpenRouterSystemCacheWrapper` 这类 `onPayload` 包装器可复用同样的手法
- **做法**: 在 `openai-completions` 的 payload 上按 `options.sessionId` 注入 `prompt_cache_key`
- **收益**: 走 OpenAI 兼容端点的所有 provider 恢复前缀缓存；命中后 input token 成本按 provider 规则打折
- **风险**: 低——`prompt_cache_key` 是纯增量字段，未识别的 provider 会忽略
- **前置**: 先验证 MiniMax / DeepSeek 是否真的识别该字段（§五）

### P0-2 · 系统提示 stable/dynamic 拆分

- **参照**: opencode PR #20109 + 4-breakpoint 模式
- **现状**: `attempt.ts:1051-1058` 单条 system prompt
- **落点**: `src/agents/pi-embedded-runner/run/attempt.ts` 的系统提示组装 + `extra-params.ts` 的 payload 包装器
- **做法**:
  1. 稳定段 = provider prompt + 全局 AGENTS.md + 工具定义
  2. 动态段 = env 信息 + 当前时间 + 工作目录 + 项目 AGENTS.md + `user.system`
  3. 两条 system message 各一个 `cache_control`，再在最后两条非 system 消息各一个 → 4 个（Anthropic 上限）
- **收益**: 工具定义（~12k token，字节级稳定）长期驻留；动态项漂移不再击穿整段。这是单项收益最大的一项
- **风险**: 中——需要谨慎划分「什么是稳定的」，且 Anthropic 只允许 4 个 breakpoint，超出会直接报错

### P0-3 · 升级 pi-ai 0.66.1 → 0.73.1

- **现状**: 落后 7 个 minor（0.67 ~ 0.73）
- **收益**: 直接吃到上游的 provider 修复，包括 opencode 审计里点名的形状错误类别
- **落点**: `package.json` 的 `pi-ai` / `pi-agent-core` / `pi-coding-agent` / `pi-tui` 四个包必须**同步升级**（版本互锁）
- **风险**: 中高——provider 层是调用核心，升级会改变请求形状
- **验收**: 必须跑 `src/agents/pi-embedded-runner-extraparams.test.ts`、`src/agents/usage*.test.ts`、以及全部 `src/agents/**` 用例

### P1-1 · 缓存能力判定改为声明式，并补 minimax

- **参照**: opencode #25984/#26460（形状错配）、DSH 的 `providers:` 声明块
- **现状**: `cache-ttl.ts:11` 硬编码 Set；`extensions.ts:41` 静默 return undefined
- **做法**:
  1. 把「哪个 provider 支持哪种缓存形状」抽成一张**声明式能力表**（provider → { 缓存机制, 是否支持 TTL, 是否需要 cache_control 块 }）
  2. 判定依据从「provider 名字」改为「provider 声明的 api 协议 + 能力表」
  3. **不命中时打一条 log**，不要静默 return undefined
- **收益**: 自建部署的 `minimax` 不会再被静默排除；将来加 provider 不用改代码
- **风险**: 低

### P1-2 · 嵌入式 runner 的流式双看门狗

- **参照**: opencode 的 idle 90s → 降级非流式 / stall 30s → 只告警
- **现状**: 只有 CLI backend 有 watchdog，嵌入式 SSE 流没有
- **落点**: `src/agents/pi-embedded-runner/run/attempt.ts`
- **做法**: 复用 `cli-watchdog-defaults.ts` 已有的 `noOutputTimeoutRatio` / `minMs` / `maxMs` 参数化思路，但** Stall 只记日志不中断**（模型可能只是在思考）
- **收益**: 上游挂起时能及时降级而不是干等；stall 不误伤长思考
- **风险**: 中——超时阈值设错会打断正常的长思考

### P1-3 · provider 能力表声明化（DSH 式）

- **参照**: DSH `llm-pi-ai` 的 `providers:` 块
- **现状**: 能力信息散在 `models-config.ts`、`model-catalog.ts`、pi-ai 的 `getCompat(model)` 表里
- **做法**: 把「协议 / 端点 / 凭据环境变量 / 模型清单 / 模态声明 / compat 开关」收敛到一处声明
- **收益**: 加自建网关不必改代码；解决「视觉模型必须显式声明模态否则发图被拒」这类坑
- **风险**: 中——牵动模型目录加载

### P2-1 · 事件流（Trajectory 式）

- **参照**: DSH 的 append-only 事件流
- **现状**: 有 usage 统计、有 session 自定义条目（cache-ttl 时间戳），但**没有统一的事件流**
- **收益**: ① 精确算真实 token 成本；② 排查 API 调用问题有据可查；③ prompt 回归测试可以基于事件流断言

### P2-2 · provider 切换体验（ccswitch 式）

- **参照**: ccswitch 的配置目录切换 + 自动备份 + 切换前预检
- **落点**: `src/agents/models-config.ts`（写 models.json）、`src/agents/model-catalog.ts`（目录刷新）
- **做法**: 切 provider 时保留旧凭据**引用**而非重写；配置目录级备份；切换前预检连通性
- **收益**: 多 provider 灰度/回滚更安全

---

## 五、建议的验证顺序（先证实，再改代码）

以下三步**不需要改任何生产代码**，就能把 §三 的三个缺口从「推断」变成「实测」：

1. **抓一次真实请求体**，看 OpenAI 兼容路径上 `prompt_cache_key` 是否缺失：
   ```
   # 在 src/agents/pi-embedded-runner/extra-params.ts 的 payload 包装器里临时打一行
   console.error("[probe] payload keys:", Object.keys(payload));
   ```
2. **看 MiniMax 返回里有没有 cache 字段**：`src/agents/usage.ts:110-115` 已会解析 `cached_tokens` / `cache_read_input_tokens`。跑几轮多轮对话后查 usage 记录里缓存 token 是否为 0。
3. **确认 minimax 是否识别 `prompt_cache_key`**：手工往 `https://api.minimax.com/anthropic` 发一个带 `prompt_cache_key` 的请求，对比不带时的 usage 字段。

第 1、2 步能直接判定 P0-1 的收益上限；第 3 步决定这条路走不走得通。

---

## 六、不建议借鉴的

- **DSH 的 Cordis 插件架构** —— 那是运行时架构级重构，PaleoClaw 现有 `extensions/*` 插件模型已经在做同样的事，重做代价远大于收益。
- **DSH 的 PTC 模式**（模型生成 TS 编排多轮工具调用）—— 值得单独立项评估，但与 API 调用层无关，且会显著放大工具执行的安全面。
- **opencode 的 1h TTL 实验开关**（`OPENCODE_EXPERIMENTAL_CACHE_1H_TTL=1`）—— pi-ai 0.66.1 已内建等价能力（`cacheRetention: "long"`，且仅对 `api.anthropic.com` 域名下 `ttl:"1h"`），不必再抄一层开关。

---

## 附：证据索引

| 结论                         | 证据                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| pi-ai 版本落后               | `package.json` → `0.66.1`；`npm view @mariozechner/pi-ai version` → `0.73.1`                    |
| Anthropic 缓存注入           | `node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js:23-33, 469-501, 688-704`          |
| OpenRouter Anthropic 缓存    | pi-ai `openai-completions.js:294`；仓库 `src/agents/pi-embedded-runner/extra-params.ts:583-634` |
| `prompt_cache_key` 分布      | pi-ai `dist/providers/*.js` 逐文件扫描（见 §3.3 表）                                            |
| 缓存资格白名单               | `src/agents/pi-embedded-runner/cache-ttl.ts:11-36`                                              |
| 白名单门禁（静默失效）       | `src/agents/pi-embedded-runner/extensions.ts:38-43`；`run/attempt.ts:1838-1847`                 |
| 系统提示单条拼接             | `src/agents/pi-embedded-runner/run/attempt.ts:1051-1058`                                        |
| 缓存保留策略                 | `src/agents/pi-embedded-runner/extra-params.ts:80-122`                                          |
| 缓存 token 统计              | `src/agents/usage.ts:16-17, 110-115`                                                            |
| 熔断 / 分级冷却              | `src/agents/auth-profiles/{usage,order}.ts`；`src/agents/model-fallback.ts:452-456, 534-541`    |
| CLI 看门狗（仅 CLI backend） | `src/agents/cli-watchdog-defaults.ts`；`src/agents/cli-backends.ts:64-149`                      |

**外部来源**：

- DeepSeek Harness 官网 https://deepseek.com/en/harness ｜ GitHub `deepseek-ai/deepseek-harness`
- opencode prompt-cache 审计 `OnlyTerp/prompt-cache-skills` → `audits/opencode.md`（审计 commit `a9ef5a0`，2026-05-27）
- ccswitch 文档 https://ccswitch.io/en/docs
- 第三方汇总 `deepseekharness.wiki/en/github`（**其「99.93% 命中率」为二手数据，未一手核实**）
