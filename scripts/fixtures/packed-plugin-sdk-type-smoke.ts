// Packed Plugin Sdk Type Smoke script supports paleoclaw repository automation.
import { defineToolPlugin } from "paleoclaw/plugin-sdk/tool-plugin";
import "./packed-plugin-sdk-setup-consumer.js";
type PublicPluginSdkModules = [
  typeof import("paleoclaw/plugin-sdk/core"),
  typeof import("paleoclaw/plugin-sdk/channel-entry-contract"),
  typeof import("paleoclaw/plugin-sdk/config-contracts"),
  typeof import("paleoclaw/plugin-sdk/plugin-entry"),
  typeof import("paleoclaw/plugin-sdk/runtime-env"),
  typeof import("paleoclaw/plugin-sdk/tool-plugin"),
];

const resolvedModules = null as unknown as PublicPluginSdkModules;
void resolvedModules;
void defineToolPlugin;
