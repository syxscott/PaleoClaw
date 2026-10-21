// Declares extension points for agent session type augmentation.
export type OpenClawAgentSessionSkillSourceAugmentation = never;

declare module "paleoclaw/plugin-sdk/agent-sessions" {
  interface Skill {
    // paleoclaw relies on the source identifier returned by skill loaders.
    source: string;
  }
}
