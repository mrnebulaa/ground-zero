import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), findUnique: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get }) }));
vi.mock("../lib/db", () => ({
  db: { user: { findUnique: mocks.findUnique } },
}));
import { currentUser } from "../lib/auth";
import { createSession } from "../lib/session";
function session() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DEV_AUTH_ENABLED", "true");
  vi.stubEnv("DEV_AUTH_SECRET", "test-only-secret-with-at-least-32-characters");
  const signed = createSession("local-reviewer");
  mocks.get.mockImplementation((name: string) =>
    name === "gz-dev-session" ? { value: signed } : undefined,
  );
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it("uses the current database role rather than a signed identity's former role", async () => {
  session();
  mocks.findUnique.mockResolvedValue({
    id: "local-reviewer",
    displayName: "Demoted user",
    role: "CONTRIBUTOR",
  });
  expect((await currentUser())?.role).toBe("CONTRIBUTOR");
});
it("does not authenticate a deleted user", async () => {
  session();
  mocks.findUnique.mockResolvedValue(null);
  expect(await currentUser()).toBeNull();
});
it("never loads the user from a valid development cookie in production", async () => {
  session();
  vi.stubEnv("NODE_ENV", "production");
  expect(await currentUser()).toBeNull();
  expect(mocks.findUnique).not.toHaveBeenCalled();
});
