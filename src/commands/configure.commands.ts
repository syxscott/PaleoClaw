import { formatCliCommand } from "../cli/command-format.js";
import { isTerminalInteractive } from "../cli/terminal-interactivity.js";
import { defaultRuntime as runtime } from "../runtime.js";
import { CONFIGURE_WIZARD_SECTIONS, parseConfigureWizardSections } from "./configure.shared.js";
import { runConfigureWizard } from "./configure.wizard.js";

/**
 * Non-interactive config subcommands surfaced when the wizard cannot run.
 * Mirrors the real `paleoclaw config <sub>` surface so the message only ever
 * points users at commands that exist (see `src/cli/config-cli.ts`).
 */
const CONFIGURE_NON_TTY_HINT = [
  "Interactive configuration requires an interactive terminal (TTY).",
  "For non-interactive setup, use these subcommands instead:",
  `  ${formatCliCommand("paleoclaw config set <path> <value>")}  write a config entry`,
  `  ${formatCliCommand("paleoclaw config get <path>")}          read a config entry`,
  `  ${formatCliCommand("paleoclaw config patch")}              apply a JSON patch`,
  `  ${formatCliCommand("paleoclaw config validate")}           validate configuration`,
].join("\n");

/** Parse `--section` input and run the requested configure wizard sections. */
export async function configureCommandFromSectionsArg(rawSections: unknown): Promise<void> {
  const { sections, invalid } = parseConfigureWizardSections(rawSections);
  if (invalid.length > 0) {
    runtime.error(
      `Invalid --section: ${invalid.map((section) => section || '""').join(", ")}. Expected one of: ${CONFIGURE_WIZARD_SECTIONS.join(", ")}. Run ${formatCliCommand("paleoclaw configure")} without --section to use the full wizard.`,
    );
    runtime.exit(1);
    return;
  }

  // Both configure and bare config share this guard before entering the wizard.
  if (!isTerminalInteractive()) {
    runtime.error(CONFIGURE_NON_TTY_HINT);
    runtime.exit(1);
    return;
  }

  // Omission opens the full chooser; an empty array means no selected changes to the runner.
  await runConfigureWizard(sections.length > 0 ? { sections } : {});
}
