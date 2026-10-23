# Google

Use Gemini models in paleoclaw through Google AI Studio or Vertex AI. The plugin
also supports media understanding, embeddings, image, music and video generation,
speech output, realtime voice, and Gemini web search.

## Get started

For Google AI Studio, run:

```bash
paleoclaw onboard --auth-choice gemini-api-key
```

You can also provide `GEMINI_API_KEY` in the Gateway's environment. Browse models
with `paleoclaw models list --provider google`.

Vertex AI uses separate Google Cloud authentication and project settings. Media,
voice, and search have their own settings and can use different models from
your agent's chat model.

See the [Google guide](https://docs.openclaw.ai/providers/google) for each setup
path and supported inputs.
