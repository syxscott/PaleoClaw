# paleoclaw DeepSeek Provider

Official paleoclaw provider plugin for DeepSeek models and web search.

Select `tools.web.search.provider: "deepseek"` to search with any model. Search
uses `DEEPSEEK_API_KEY`, a plugin search key, or a configured model-provider key;
see the setup documentation for credential precedence and query limits.

Install from paleoclaw:

```bash
paleoclaw plugins install @paleoclaw/deepseek-provider
paleoclaw gateway restart
```

See <https://docs.openclaw.ai/providers/deepseek> for setup and configuration.
