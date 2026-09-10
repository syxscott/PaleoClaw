import crypto from "node:crypto";
import { safeEqualSecret } from "../security/secret-equal.js";

export function validateLineSignature(
  body: string,
  signature: string,
  channelSecret: string,
): boolean {
  const hash = crypto.createHmac("SHA256", channelSecret).update(body).digest("base64");
  // safeEqualSecret pads both sides to equal length, so timingSafeEqual never
  // throws on mismatched signature lengths and no length is leaked via timing.
  return safeEqualSecret(signature, hash);
}
