import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { authService } from "../lib/passkeys/service";
import {
  hash,
  recoveryHash,
  assertOrigin,
  config,
} from "../lib/passkeys/config";
import { issueSession, readSession } from "../lib/passkeys/sessions";
import { claimService } from "../lib/claims";
if (!process.env.TEST_DATABASE_URL)
  throw new Error("Dedicated TEST_DATABASE_URL required.");
const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
const service = authService(db);
const ids: string[] = [];
async function fixture() {
  const id = randomUUID();
  ids.push(id);
  const username = "test_" + id.replaceAll("-", "").slice(0, 20);
  await db.user.create({ data: { id, username, displayName: username } });
  await db.passkey.create({
    data: {
      id: id + "-key",
      userId: id,
      publicKey: Buffer.from("fixture-only"),
      counter: 0,
      label: "Synthetic",
      backedUp: false,
    },
  });
  const secret = await db.$transaction((tx) =>
    issueSession(tx, id, 0, "MEMBER"),
  );
  return { id, username, secret };
}
beforeAll(async () => {
  await db.authRateBucket.deleteMany({ where: { key: { startsWith: "v2:" } } });
  vi.stubEnv("AUTH_ORIGIN", "http://localhost:3102");
  vi.stubEnv("AUTH_RP_ID", "localhost");
  vi.stubEnv("RECOVERY_CODE_KEY", "ab".repeat(32));
});
afterAll(async () => {
  await db.authCeremony.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.authRateBucket.deleteMany({ where: { key: { startsWith: "v2:" } } });
  await db.$disconnect();
  vi.unstubAllEnvs();
});
it("defaults registration off and rejects unsafe configuration and CSRF", async () => {
  vi.stubEnv("AUTH_REGISTRATION_ENABLED", "false");
  await expect(service.begin("register", {})).rejects.toThrow("disabled");
  expect(() =>
    assertOrigin(
      new Request("http://localhost:3102/api/auth/begin", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          "Content-Type": "application/json",
        },
      }),
    ),
  ).toThrow();
  vi.stubEnv("RECOVERY_DELAY_HOURS", "0");
  expect(() => config()).toThrow();
  vi.stubEnv("RECOVERY_DELAY_HOURS", "24");
});
it("stores only session hashes, rejects expired and revoked sessions", async () => {
  const u = await fixture();
  expect(
    await db.authSession.findUnique({ where: { tokenHash: u.secret } }),
  ).toBeNull();
  await db.authSession.update({
    where: { tokenHash: hash(u.secret) },
    data: { expiresAt: new Date(0) },
  });
  await expect(service.account(u.secret)).rejects.toThrow();
  const fresh = await db.$transaction((tx) =>
    issueSession(tx, u.id, 0, "MEMBER"),
  );
  await service.logout(fresh);
  await expect(service.account(fresh)).rejects.toThrow();
});
it("denies cross-account passkey removal and stale step-up", async () => {
  const a = await fixture(),
    b = await fixture();
  await db.passkey.create({
    data: {
      id: a.id + "-backup",
      userId: a.id,
      publicKey: Buffer.from("fixture"),
      counter: 0,
      label: "Backup",
      backedUp: false,
    },
  });
  await expect(service.remove(a.secret, b.id + "-key")).rejects.toThrow(
    "this account",
  );
  expect(await db.passkey.count({ where: { userId: b.id } })).toBe(1);
  await db.authSession.update({
    where: { tokenHash: hash(a.secret) },
    data: { createdAt: new Date(Date.now() - 16 * 60000) },
  });
  await expect(service.codes(a.secret)).rejects.toThrow("fresh");
});
it("codes are account-bound keyed hashes and cannot recover another account", async () => {
  const a = await fixture(),
    b = await fixture();
  const { codes } = await service.codes(a.secret);
  expect(new Set(codes).size).toBe(8);
  expect(
    await db.recoveryCode.findUnique({ where: { hash: codes[0] } }),
  ).toBeNull();
  expect(recoveryHash(a.id, codes[0])).not.toBe(recoveryHash(b.id, codes[0]));
  await expect(service.recover(b.username, codes[0])).rejects.toThrow();
  await expect(service.recover(a.username, "00".repeat(16))).rejects.toThrow();
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: a.id } })).accountState,
  ).toBe("ACTIVE");
});
it("concurrent recovery attempts consume exactly one code and revoke claim access", async () => {
  const u = await fixture();
  const { codes } = await service.codes(u.secret);
  const results = await Promise.allSettled([
    service.recover(u.username, codes[0]),
    service.recover(u.username, codes[1]),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.recoveryCode.count({ where: { userId: u.id } })).toBe(7);
  expect(
    await db.recoveryAttempt.count({ where: { userId: u.id, active: true } }),
  ).toBe(1);
  await expect(service.account(u.secret)).rejects.toThrow();
  await expect(
    claimService(db).create(
      { id: u.id, role: "CONTRIBUTOR", sessionHash: hash(u.secret) },
      {
        title: "Synthetic recovery test claim",
        description: "This is a synthetic security test, not real evidence.",
        kind: "FACTUAL",
        sources: [
          {
            url: "https://example.org/test",
            attribution: "Synthetic fixture",
            note: "Synthetic evidence for testing only.",
            relation: "CONTEXT",
          },
        ],
      },
    ),
  ).rejects.toThrow();
  const recovered = results.find((r) => r.status === "fulfilled");
  if (recovered?.status !== "fulfilled") throw new Error("Expected recovery");
  await expect(service.codes(recovered.value.session)).rejects.toThrow();
  await expect(service.cancel(recovered.value.session)).rejects.toThrow();
  await expect(
    service.begin("recover-finish", {}, recovered.value.session),
  ).rejects.toThrow("delay");
  await expect(
    db.$transaction((tx) => readSession(tx, hash(recovered.value.session))),
  ).rejects.toThrow();
});
it("only original passkey proof can cancel, consumes codes and invalidates recovery ceremonies", async () => {
  const u = await fixture();
  const { codes } = await service.codes(u.secret);
  const recovery = await service.recover(u.username, codes[0]);
  const user = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  // Service-level fixture models the CONTEST session issued only after verified old-key login.
  const contest = await db.$transaction((tx) =>
    issueSession(tx, u.id, user.authVersion, "CONTEST"),
  );
  await service.cancel(contest);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: u.id } })).accountState,
  ).toBe("ACTIVE");
  await expect(service.account(recovery.session)).rejects.toThrow();
  await expect(service.account(contest)).rejects.toThrow();
  await expect(service.recover(u.username, codes[0])).rejects.toThrow();
  expect(await db.recoveryCode.count({ where: { userId: u.id } })).toBe(0);
});
it("rejects forged and expired ceremonies without creating credentials", async () => {
  const u = await fixture();
  const { binding } = await service.begin(
    "add",
    { label: "Synthetic" },
    u.secret,
  );
  await expect(
    service.finish(
      binding,
      { id: "forged", type: "public-key", response: {} },
      u.secret,
    ),
  ).rejects.toThrow();
  await db.authCeremony.update({
    where: { bindingHash: hash(binding) },
    data: { expiresAt: new Date(0) },
  });
  await expect(
    service.finish(
      binding,
      { id: "forged", type: "public-key", response: {} },
      u.secret,
    ),
  ).rejects.toThrow("expired");
  expect(await db.passkey.count({ where: { userId: u.id } })).toBe(1);
});

it("recovery remains possible with ten existing keys and removal preserves step-up age", async () => {
  const u = await fixture();
  await db.passkey.createMany({
    data: Array.from({ length: 9 }, (_, i) => ({
      id: u.id + "-" + i,
      userId: u.id,
      publicKey: Buffer.from("fixture"),
      counter: 0,
      label: "Synthetic backup",
      backedUp: false,
    })),
  });
  const authenticatedAt = new Date(Date.now() - 10 * 60000);
  await db.authSession.update({
    where: { tokenHash: hash(u.secret) },
    data: { createdAt: authenticatedAt },
  });
  const rotated = await service.remove(u.secret, u.id + "-0");
  expect(
    (
      await db.authSession.findUniqueOrThrow({
        where: { tokenHash: hash(rotated.session) },
      })
    ).createdAt,
  ).toEqual(authenticatedAt);
  await db.passkey.create({
    data: {
      id: u.id + "-0",
      userId: u.id,
      publicKey: Buffer.from("fixture"),
      counter: 0,
      label: "Backup",
      backedUp: false,
    },
  });
  const { codes } = await service.codes(rotated.session);
  const recovery = await service.recover(u.username, codes[0]);
  await expect(
    service.begin("recover-enroll", { label: "Replacement" }, recovery.session),
  ).resolves.toHaveProperty("options");
  await db.recoveryAttempt.updateMany({
    where: { userId: u.id },
    data: { holdUntil: new Date(0) },
  });
  await expect(
    service.begin("recover-finish", {}, recovery.session),
  ).resolves.toHaveProperty("options");
});

it("limits actions and networks independently, saturates concurrent counters, and resets expired budgets", async () => {
  const { consumeLimit, limitAuthRequest } =
    await import("../lib/passkeys/limits");
  const identity = randomUUID();
  const now = Math.floor(Date.now() / 60000) * 60000 + 1000;
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      consumeLimit(db, "network", "login", identity, 3, 60000, now),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  await expect(
    consumeLimit(db, "network", "login", identity + "-other", 3, 60000, now),
  ).resolves.toBeUndefined();
  await expect(
    consumeLimit(db, "network", "cancel", identity, 3, 60000, now),
  ).resolves.toBeUndefined();
  const buckets = await db.authRateBucket.findMany({
    where: { key: { startsWith: "v2:network:login:" } },
  });
  expect(buckets.every((b) => !b.key.includes(identity))).toBe(true);
  expect(buckets.some((b) => b.count === 4)).toBe(true);
  await expect(
    consumeLimit(db, "network", "login", identity, 3, 60000, now + 60000),
  ).resolves.toBeUndefined();
  const u = await fixture();
  // An exhausted anonymous network budget does not consume authenticated quotas.
  vi.stubEnv("AUTH_TRUST_PROXY", "true");
  const req = new Request("http://localhost:3102/api/auth/account", {
    headers: { "x-gz-client-ip": "192.0.2.44" },
  });
  for (let i = 0; i < 60; i++)
    await limitAuthRequest(db, req, "account", {}, "", "");
  await expect(
    limitAuthRequest(db, req, "account", {}, "", ""),
  ).rejects.toThrow("Too many");
  await expect(
    limitAuthRequest(db, req, "account", {}, u.secret, ""),
  ).resolves.toBeUndefined();
  vi.stubEnv("AUTH_TRUST_PROXY", "false");
});

it("recovery guesses do not exhaust a victim's budget on another network or affect account state", async () => {
  const { limitAuthRequest } = await import("../lib/passkeys/limits");
  const u = await fixture();
  const { codes } = await service.codes(u.secret);
  vi.stubEnv("AUTH_TRUST_PROXY", "true");
  const req = (ip: string) =>
    new Request("http://localhost:3102/api/auth/recover", {
      headers: { "x-gz-client-ip": ip },
    });
  for (let i = 0; i < 5; i++) {
    await limitAuthRequest(
      db,
      req("192.0.2.55"),
      "recover",
      { username: u.username },
      "",
      "",
    );
    await expect(service.recover(u.username, "00".repeat(16))).rejects.toThrow(
      "Recovery unavailable",
    );
  }
  await expect(
    limitAuthRequest(
      db,
      req("192.0.2.55"),
      "recover",
      { username: u.username },
      "",
      "",
    ),
  ).rejects.toThrow("Too many");
  expect((await service.account(u.secret)).kind).toBe("MEMBER");
  expect(await db.recoveryCode.count({ where: { userId: u.id } })).toBe(8);
  await limitAuthRequest(
    db,
    req("198.51.100.55"),
    "recover",
    { username: u.username },
    "",
    "",
  );
  await expect(service.recover(u.username, codes[0])).resolves.toHaveProperty(
    "session",
  );
  vi.stubEnv("AUTH_TRUST_PROXY", "false");
});

it("pending requests neither extend a hold nor consume another code; expiry invalidates recovery-only access", async () => {
  const u = await fixture();
  const { codes } = await service.codes(u.secret);
  const recovery = await service.recover(u.username, codes[0]);
  const attempt = await db.recoveryAttempt.findFirstOrThrow({
    where: { userId: u.id, active: true },
  });
  for (const code of [codes[0], codes[1], "00".repeat(16)])
    await expect(service.recover(u.username, code)).rejects.toThrow(
      "Recovery unavailable",
    );
  expect(
    await db.recoveryAttempt.findUnique({ where: { id: attempt.id } }),
  ).toEqual(attempt);
  expect(await db.recoveryCode.count({ where: { userId: u.id } })).toBe(7);
  const { binding } = await service.begin(
    "recover-enroll",
    { label: "Replacement" },
    recovery.session,
  );
  await db.recoveryAttempt.update({
    where: { id: attempt.id },
    data: { expiresAt: new Date(0) },
  });
  await expect(service.account(recovery.session)).rejects.toThrow("expired");
  await expect(
    service.begin("recover-enroll", { label: "Replacement" }, recovery.session),
  ).rejects.toThrow("expired");
  await expect(
    service.finish(
      binding,
      { id: "fake", type: "public-key", response: {} },
      recovery.session,
    ),
  ).rejects.toThrow("expired");
  await expect(service.account(u.secret)).rejects.toThrow();
  await expect(service.recover(u.username, codes[0])).rejects.toThrow();
  const restarted = await service.recover(u.username, codes[1]);
  await expect(service.account(recovery.session)).rejects.toThrow();
  expect((await service.account(restarted.session)).kind).toBe("RECOVERY");
  const user = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  const contest = await db.$transaction((tx) =>
    issueSession(tx, u.id, user.authVersion, "CONTEST"),
  );
  // Cancellation and another code submission serialize; cancellation wins in either ordering.
  const results = await Promise.allSettled([
    service.cancel(contest),
    service.recover(u.username, codes[2]),
  ]);
  expect(results[0].status).toBe("fulfilled");
  expect(results[1].status).toBe("rejected");
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: u.id } })).accountState,
  ).toBe("ACTIVE");
  expect(await db.recoveryCode.count({ where: { userId: u.id } })).toBe(0);
  await expect(service.account(restarted.session)).rejects.toThrow();
});

it("simultaneous reuse of one recovery code creates only one attempt", async () => {
  const u = await fixture();
  const { codes } = await service.codes(u.secret);
  const results = await Promise.allSettled([
    service.recover(u.username, codes[0]),
    service.recover(u.username, codes[0]),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    await db.recoveryAttempt.count({ where: { userId: u.id, active: true } }),
  ).toBe(1);
  expect(await db.recoveryCode.count({ where: { userId: u.id } })).toBe(7);
});

it("rejects another session's ceremony and ceremonies bound to revoked sessions", async () => {
  const a = await fixture(),
    b = await fixture();
  const { binding } = await service.begin(
    "add",
    { label: "Synthetic" },
    a.secret,
  );
  const response = { id: "forged", type: "public-key", response: {} };
  await expect(service.finish(binding, response, b.secret)).rejects.toThrow(
    "another session",
  );
  expect(await db.passkey.count({ where: { userId: b.id } })).toBe(1);
  await service.logout(a.secret, true);
  await expect(service.finish(binding, response, a.secret)).rejects.toThrow(
    "revoked",
  );
  expect(await db.passkey.count({ where: { userId: a.id } })).toBe(1);
});
