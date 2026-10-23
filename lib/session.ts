import { createHmac, timingSafeEqual } from "node:crypto";
export const cookieName = "gz-dev-session";
export function devAuthEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_ENABLED === "true" &&
    (process.env.DEV_AUTH_SECRET?.length ?? 0) >= 32
  );
}
export function matchesSecret(value: string) {
  const expected = process.env.DEV_AUTH_SECRET ?? "";
  const a = Buffer.from(value),
    b = Buffer.from(expected);
  return devAuthEnabled() && a.length === b.length && timingSafeEqual(a, b);
}
function sign(payload: string) {
  return createHmac("sha256", process.env.DEV_AUTH_SECRET ?? "")
    .update(payload)
    .digest("hex");
}
export function createSession(userId: string, now = Date.now()) {
  if (!devAuthEnabled())
    throw new Error("Development authentication is disabled.");
  const payload = `${userId}.${now + 8 * 60 * 60 * 1000}`;
  return `${payload}.${sign(payload)}`;
}
export function verifySession(
  value: string | undefined,
  now = Date.now(),
): string | null {
  if (!devAuthEnabled() || !value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [id, expires, signature] = parts;
  const expected = sign(`${id}.${expires}`);
  if (
    !id ||
    !/^\d+$/.test(expires) ||
    Number(expires) <= now ||
    Number(expires) > now + 8 * 60 * 60 * 1000 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return null;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ? id
    : null;
}
