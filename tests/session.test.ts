import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  devAuthEnabled,
  matchesSecret,
  verifySession,
} from "../lib/session";
import { requireActor, requireReviewer } from "../lib/claims";
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DEV_AUTH_ENABLED", "true");
  vi.stubEnv("DEV_AUTH_SECRET", "test-only-secret-with-at-least-32-characters");
});
afterEach(() => vi.unstubAllEnvs());
describe("development authentication", () => {
  it("verifies signed sessions and rejects tampering, expiry, and secret rotation", () => {
    const token = createSession("local-contributor", 1000);
    expect(verifySession(token, 1001)).toBe("local-contributor");
    expect(
      verifySession(token.replace("contributor", "reviewer"), 1001),
    ).toBeNull();
    expect(verifySession(token, 1000 + 8 * 3600000)).toBeNull();
    vi.stubEnv(
      "DEV_AUTH_SECRET",
      "a-different-secret-with-at-least-32-characters",
    );
    expect(verifySession(token, 1001)).toBeNull();
  });
  it.each(["production", "test"])(
    "fails closed in %s even with the flag set",
    (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      expect(devAuthEnabled()).toBe(false);
      expect(matchesSecret(process.env.DEV_AUTH_SECRET!)).toBe(false);
      expect(verifySession("anything")).toBeNull();
    },
  );
  it("rejects missing, short, or incorrect secrets", () => {
    expect(matchesSecret("wrong")).toBe(false);
    vi.stubEnv("DEV_AUTH_SECRET", "short");
    expect(devAuthEnabled()).toBe(false);
    vi.stubEnv("DEV_AUTH_SECRET", "");
    expect(devAuthEnabled()).toBe(false);
  });
  it("blocks anonymous writes and limits reviews to reviewers", () => {
    expect(() => requireActor(null)).toThrow();
    for (const role of ["CONTRIBUTOR", "MODERATOR"] as const)
      expect(() => requireReviewer({ id: "test", role })).toThrow();
    expect(requireReviewer({ id: "test", role: "REVIEWER" }).id).toBe("test");
  });
});

it("rejects a valid development session and session creation in production", () => {
  const token = createSession("local-reviewer");
  expect(verifySession(token)).toBe("local-reviewer");
  vi.stubEnv("NODE_ENV", "production");
  expect(verifySession(token)).toBeNull();
  expect(() => createSession("local-reviewer")).toThrow();
});
it.each([
  undefined,
  "",
  "user.abc.sig",
  "user.9999999999999999999999." + "a".repeat(64),
  "user.1." + "x".repeat(64),
])("rejects malformed sessions without throwing (%s)", (value) => {
  expect(verifySession(value)).toBeNull();
});
