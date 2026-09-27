import { z } from "zod";

export const QqbotAccountSchema = z
  .object({
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    appId: z.string().optional(),
    appSecret: z.string().optional(),
    clientSecret: z.string().optional(),
    mode: z.literal("websocket").optional(),
    sandbox: z.boolean().optional(),
    markdown: z.boolean().optional(),
    intents: z.number().int().min(0).optional(),
    dmPolicy: z.enum(["open", "allowlist", "pairing", "disabled"]).optional(),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    groupPolicy: z.enum(["open", "allowlist", "pairing", "disabled"]).optional(),
    groupAllowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    defaultTo: z.string().optional(),
  })
  .strict();

export const QqbotConfigSchema = QqbotAccountSchema.extend({
  accounts: z.record(z.string(), QqbotAccountSchema.optional()).optional(),
  defaultAccount: z.string().optional(),
});
