import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { PrismaClient } from "@prisma/client";
import { AuthError, config, hash, usernameInput } from "./config";
import { readSession } from "./sessions";

const actions = [
  "register",
  "login",
  "add",
  "recover-enroll",
  "recover-finish",
  "recover",
  "codes",
  "remove",
  "cancel",
  "account",
  "logout",
  "invalid",
] as const;
type Action = (typeof actions)[number];
export class RateLimitError extends AuthError {
  constructor(public retryAfter: number) {
    super("Too many attempts. Try again later.");
  }
}

// The proxy must overwrite this header, and the app port must not be reachable
// directly. Never trust forwarded headers by default or parse an arbitrary chain.
export function requestNetwork(request: Request): string {
  if (process.env.AUTH_TRUST_PROXY !== "true") {
    if (
      new URL(config().origin).hostname === "localhost" &&
      process.env.NODE_ENV !== "production"
    )
      return "local";
    throw new AuthError("Trusted authentication proxy is not configured.");
  }
  const ip = request.headers.get("x-gz-client-ip") ?? "";
  const family = isIP(ip);
  if (!family || ip.includes("%"))
    throw new AuthError("Invalid authentication network header.");
  if (family === 4) return ip;
  const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right] = normalized.split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const parts =
    right === undefined
      ? start
      : [...start, ...Array(8 - start.length - end.length).fill("0"), ...end];
  const words = parts.map((p) => parseInt(p, 16));
  if (words.slice(0, 5).every((w) => w === 0) && words[5] === 65535)
    return [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join(
      ".",
    );
  // A /64 budget prevents trivial rotation of IPv6 interface identifiers.
  return (
    words
      .slice(0, 4)
      .map((w) => w.toString(16))
      .join(":") + "::/64"
  );
}

// Fixed slots bound storage even with arbitrary network/account inputs. A keyed,
// window-dependent mapping hides addresses and prevents targeted slot selection.
// Collisions can share a budget; neither the raw identifier nor its HMAC is stored.
export async function consumeLimit(
  db: PrismaClient,
  lane: "network" | "account" | "recovery-pair",
  action: Action,
  identity: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  const window = Math.floor(now / windowMs);
  const slot = createHmac("sha256", Buffer.from(config().key, "hex"))
    .update(JSON.stringify(["auth-rate-v2", lane, action, window, identity]))
    .digest()
    .readUInt16BE(0);
  const key = `v2:${lane}:${action}:${slot}`;
  const expiresAt = new Date((window + 1) * windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "AuthRateBucket" ("key", "count", "expiresAt") VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "AuthRateBucket"."expiresAt" <= ${new Date(now)} THEN 1 ELSE LEAST("AuthRateBucket"."count" + 1, ${limit + 1}) END,
      "expiresAt" = CASE WHEN "AuthRateBucket"."expiresAt" <= ${new Date(now)} THEN EXCLUDED."expiresAt" ELSE "AuthRateBucket"."expiresAt" END
    RETURNING "count"`;
  if (rows[0].count > limit)
    throw new RateLimitError(
      Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
    );
}

export async function limitAuthRequest(
  db: PrismaClient,
  request: Request,
  operation: string,
  input: Record<string, unknown>,
  secret: string,
  binding: string,
) {
  let candidate: unknown = operation;
  if (operation === "begin") candidate = input.purpose;
  if (operation === "finish") {
    const ceremony =
      binding.length === 43
        ? await db.authCeremony.findUnique({
            where: { bindingHash: hash(binding) },
          })
        : null;
    candidate =
      ceremony && ceremony.expiresAt > new Date()
        ? ceremony.purpose
        : "invalid";
  }
  const action = actions.includes(candidate as Action)
    ? (candidate as Action)
    : "invalid";
  // Only a verified session can select an account budget. Unknown cookies and
  // supplied usernames cannot spend another member's authenticated allowance.
  const authenticated =
    secret.length === 43
      ? await db
          .$transaction((tx) =>
            readSession(tx, hash(secret), ["MEMBER", "RECOVERY", "CONTEST"]),
          )
          .catch((error) => {
            if (error instanceof AuthError) return null;
            throw error;
          })
      : null;
  if (authenticated) {
    await consumeLimit(
      db,
      "account",
      action,
      authenticated.user.id,
      action === "account" ? 120 : 30,
      60000,
    );
    if (action !== "recover") return;
  }
  const network = requestNetwork(request);
  const slow = action === "recover" || action === "register";
  await consumeLimit(
    db,
    "network",
    action,
    network,
    slow ? 20 : 60,
    slow ? 900000 : 60000,
  );
  if (action === "recover") {
    const parsed = usernameInput.safeParse(input.username);
    if (parsed.success)
      await consumeLimit(
        db,
        "recovery-pair",
        action,
        JSON.stringify([network, parsed.data]),
        5,
        900000,
      );
  }
}
