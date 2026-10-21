import type { ChatCommandDefinition, CommandArgs } from "paleoclaw/plugin-sdk/command-auth-native";
import type { PluginCommandCatalogDecision } from "paleoclaw/plugin-sdk/plugin-command-runtime";
import type { ReplyPayload } from "paleoclaw/plugin-sdk/reply-dispatch-runtime";
import type { ResolvedAgentRoute } from "paleoclaw/plugin-sdk/routing";
import type { BaseComponentInteraction, CommandInteraction } from "../internal/discord.js";
import type { DiscordCommandArgContext } from "./native-command-ui.types.js";

export type DispatchDiscordCommandInteractionParams = DiscordCommandArgContext & {
  interaction: CommandInteraction | BaseComponentInteraction;
  prompt: string;
  command: ChatCommandDefinition;
  commandArgs?: CommandArgs;
  preferFollowUp: boolean;
  responseEphemeral?: boolean;
  suppressReplies?: boolean;
  pluginCommandDispatch: PluginCommandCatalogDecision;
};

export type DispatchDiscordCommandInteractionResult = {
  accepted: boolean;
  effectiveRoute?: ResolvedAgentRoute;
  hiddenFinalReply?: ReplyPayload;
};

export type DispatchDiscordCommandInteraction = (
  params: DispatchDiscordCommandInteractionParams,
) => Promise<DispatchDiscordCommandInteractionResult>;
