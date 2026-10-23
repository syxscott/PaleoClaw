import { renderMarkdownFence, renderWikiMarkdown } from "./markdown.js";

export function buildSourcePage(raw: string, updatedAt: string): string {
  return renderWikiMarkdown({
    frontmatter: {
      pageType: "source",
      id: "source.imported",
      title: "imported",
      sourceType: "memory-unsafe-local",
      status: "active",
      updatedAt,
    },
    body: [
      "# imported",
      "",
      "## Content",
      renderMarkdownFence(raw, "text"),
      "",
      "## Notes",
      "<!-- paleoclaw:human:start -->",
      "<!-- paleoclaw:human:end -->",
      "",
    ].join("\n"),
  });
}
