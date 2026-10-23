import { createHash, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
export const sessionCookie = "__Host-gz-session";
export const ceremonyCookie = "__Host-gz-ceremony";
export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};
export const token = () => randomBytes(32).toString("base64url");
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class AuthError extends Error {}
export const usernameInput = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/)
  .refine(
    (s) =>
      !/^(admin|moderator|reviewer|support|staff|system|groundzero|ground_zero)(_|$)/.test(
        s,
      ),
    "That username is reserved.",
  );
export function config() {
  const origin = process.env.AUTH_ORIGIN;
  const rpID = process.env.AUTH_RP_ID;
  const key = process.env.RECOVERY_CODE_KEY;
  if (!origin || !rpID || !key || !/^[a-f0-9]{64,}$/i.test(key))
    throw new AuthError("Passkey authentication is not configured.");
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    url.hostname !== rpID ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && url.hostname === "localhost"))
  )
    throw new AuthError("Invalid authentication origin configuration.");
  const delay = Number(process.env.RECOVERY_DELAY_HOURS ?? 24);
  if (!Number.isFinite(delay) || delay < 24 || delay > 48)
    throw new AuthError("Recovery delay must be between 24 and 48 hours.");
  return { origin, rpID, key, delay };
}
export function recoveryHash(userId: string, code: string) {
  return createHmac("sha256", Buffer.from(config().key, "hex"))
    .update(userId + "\0" + code)
    .digest("hex");
}
export function assertOrigin(request: Request) {
  if (
    request.headers.get("origin") !== config().origin ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    throw new AuthError("Cross-origin request rejected.");
}
