export const LOCAL_MEMORY_EMBEDDING_PROVIDER_ID = "local";
export const LLAMA_CPP_PROVIDER_INSTALL_COMMAND =
  "paleoclaw plugins install @paleoclaw/llama-cpp-provider";

export const MISSING_LOCAL_MEMORY_EMBEDDING_PROVIDER_MESSAGE = [
  "Unknown memory embedding provider: local.",
  "Local GGUF embeddings are provided by the official llama.cpp provider plugin.",
  "Semantic memory recall is degraded until the managed llama-server is configured.",
  `Install it with: ${LLAMA_CPP_PROVIDER_INSTALL_COMMAND}`,
  "Then run `paleoclaw configure` and choose llama.cpp to set up the managed llama-server.",
  "Then restart paleoclaw and retry: paleoclaw memory status --deep",
].join("\n");
