# paleoclaw Amazon Bedrock Provider

Official paleoclaw provider plugin for Amazon Bedrock. It adds Bedrock model discovery, text generation, embeddings, and guardrail-aware provider routing for agents that use AWS-hosted models.

Install from paleoclaw:

```bash
paleoclaw plugins install @paleoclaw/amazon-bedrock-provider
```

Configure AWS credentials and region through your normal paleoclaw credential/profile setup, then select Bedrock models with the `amazon-bedrock/...` provider prefix.
