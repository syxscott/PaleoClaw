import { expect, it } from "vitest";
import {
  getOfficialExternalPluginCatalogEntry,
  getOfficialExternalPluginCatalogManifest,
  resolveOfficialExternalPluginInstall,
} from "./official-external-plugin-catalog.js";

it.each([
  ["slack-huddles", "@paleoclaw/slack-huddles", "slack_huddles", "slack-huddle"],
  ["teams-meetings", "@paleoclaw/teams-meetings", "teams_meetings", "teams"],
  ["zoom-meetings", "@paleoclaw/zoom-meetings", "zoom_meetings", "zoom"],
] as const)(
  "lists %s as an official external meeting plugin",
  (id, npmSpec, toolId, transcriptSourceProviderId) => {
    const entry = getOfficialExternalPluginCatalogEntry(id);
    if (!entry) {
      throw new Error(`Expected external meeting plugin ${id}`);
    }
    const contracts = getOfficialExternalPluginCatalogManifest(entry)?.contracts;

    expect(resolveOfficialExternalPluginInstall(entry)).toEqual({
      clawhubSpec: `PaleoHub:${npmSpec}`,
      npmSpec,
      defaultChoice: "npm",
      minHostVersion: ">=2026.9.8",
    });
    expect(contracts?.tools).toEqual([toolId]);
    expect(contracts?.transcriptSourceProviders).toEqual([transcriptSourceProviderId]);
  },
);
