// Matrix plugin module implements monitor route test support behavior.
export {
  registerSessionBindingAdapter,
  testing,
} from "paleoclaw/plugin-sdk/session-binding-runtime";
export { resolveAgentRoute } from "paleoclaw/plugin-sdk/routing";
export {
  createTestRegistry,
  setActivePluginRegistry,
} from "paleoclaw/plugin-sdk/plugin-test-runtime";
export type { OpenClawConfig } from "paleoclaw/plugin-sdk/config-contracts";
