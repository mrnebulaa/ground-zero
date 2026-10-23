import { afterEach, expect, it, vi } from "vitest";
import { requestNetwork } from "../lib/passkeys/limits";
afterEach(() => vi.unstubAllEnvs());
function request(ip?: string) {
  return new Request("https://example.org/api/auth/begin", {
    headers: ip ? { "x-gz-client-ip": ip } : {},
  });
}
it("fails closed without a trusted proxy in production and ignores forged local headers", () => {
  vi.stubEnv("AUTH_ORIGIN", "http://localhost:3000");
  vi.stubEnv("AUTH_RP_ID", "localhost");
  vi.stubEnv("RECOVERY_CODE_KEY", "ab".repeat(32));
  vi.stubEnv("AUTH_TRUST_PROXY", "false");
  vi.stubEnv("NODE_ENV", "production");
  expect(() => requestNetwork(request("192.0.2.1"))).toThrow("proxy");
  vi.stubEnv("NODE_ENV", "development");
  expect(requestNetwork(request("192.0.2.1"))).toBe("local");
  expect(requestNetwork(request("198.51.100.1"))).toBe("local");
});
it("normalizes IPv6 /64s and mapped IPv4 while rejecting proxy chains and missing addresses", () => {
  vi.stubEnv("AUTH_TRUST_PROXY", "true");
  expect(requestNetwork(request("2001:db8:0:1::a"))).toBe(
    requestNetwork(request("2001:0db8:0000:0001:ffff::b")),
  );
  expect(requestNetwork(request("::ffff:192.0.2.1"))).toBe("192.0.2.1");
  expect(requestNetwork(request("::ffff:c000:201"))).toBe("192.0.2.1");
  for (const ip of [undefined, "192.0.2.1, 10.0.0.1", "bad", "fe80::1%en0"])
    expect(() => requestNetwork(request(ip))).toThrow();
});
