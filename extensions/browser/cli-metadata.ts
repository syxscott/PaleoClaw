/**
 * Browser CLI metadata entry. It registers the `paleoclaw browser` command lazily
 * so command discovery does not load the full browser runtime.
 */
import { definePluginEntry, type OpenClawPluginApi } from "paleoclaw/plugin-sdk/plugin-entry";
import { isBrowserMachineOutput } from "./cli-output-mode.js";

export function registerBrowserCliMetadata(api: OpenClawPluginApi) {
  api.registerCli(
    async ({ program }) => {
      const { registerBrowserCli } = await import("./src/cli/browser-cli.js");
      registerBrowserCli(program, process.argv, api.rootDir);
    },
    {
      commands: ["browser"],
      descriptors: [
        {
          name: "browser",
          description: "Manage paleoclaw's dedicated browser (Chrome/Chromium)",
          hasSubcommands: true,
          machineOutput: isBrowserMachineOutput,
        },
      ],
    },
  );
}

export default definePluginEntry({
  id: "browser",
  name: "Browser",
  description: "Default browser tool plugin",
  register: registerBrowserCliMetadata,
});
