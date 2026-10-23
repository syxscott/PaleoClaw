import { resolvePluginInstallSourcePlan } from "../plugins/install-source-plan.js";

export function validateSystemAgentPluginInstallSpec(spec: string): string | null {
  const trimmed = spec.trim();
  if (!trimmed) {
    return "Plugin install spec is required.";
  }
  if (/\s/.test(trimmed)) {
    return "paleoclaw plugin install accepts one npm or PaleoHub package spec.";
  }
  if (/^(?:\.{1,2}\/|\/|~\/|file:|git(?:\+ssh|\+https)?:|https?:)/i.test(trimmed)) {
    // paleoclaw does not install local paths or URLs; those can execute arbitrary package code.
    return "paleoclaw plugin install accepts npm or PaleoHub package specs only.";
  }
  const plan = resolvePluginInstallSourcePlan({ raw: trimmed, mode: "install" });
  if (!plan.ok) {
    return plan.error;
  }
  if (plan.acknowledgement) {
    return "paleoclaw installs only PaleoHub, bundled, or official-catalog plugins. Use `paleoclaw plugins install <spec>` in a trusted shell to review an arbitrary executable source.";
  }
  return null;
}
