import { describe, expect, it } from "vitest";
import { claimInput, sourceUrl } from "../lib/validation";
const source = {
  url: "https://example.org/source",
  attribution: "Fictional test fixture",
  note: "This is test data, not real evidence.",
  relation: "CONTEXT",
};
const claim = {
  title: "Fictional test claim",
  description: "This test fixture makes no real-world factual assertion.",
  kind: "FACTUAL",
  sources: [source],
};
describe("untrusted claim input", () => {
  it("normalizes URLs and strips caller-supplied status and author", () => {
    expect(sourceUrl.parse(" HTTPS://EXAMPLE.ORG ")).toBe(
      "https://example.org/",
    );
    const parsed = claimInput.parse({
      ...claim,
      status: "SUPPORTED",
      authorId: "attacker",
    });
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("authorId");
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///etc/passwd",
    "https://user:password@example.org",
    "not a URL",
  ])("rejects unsafe URL %s", (url) => {
    expect(sourceUrl.safeParse(url).success).toBe(false);
  });
  it("requires attributed evidence and bounded text", () => {
    expect(claimInput.safeParse({ ...claim, sources: [] }).success).toBe(false);
    expect(
      claimInput.safeParse({ ...claim, title: " ".repeat(20) }).success,
    ).toBe(false);
    expect(
      claimInput.safeParse({
        ...claim,
        sources: [{ ...source, attribution: "" }],
      }).success,
    ).toBe(false);
    expect(
      claimInput.safeParse({ ...claim, description: "a".repeat(10001) })
        .success,
    ).toBe(false);
  });
  it("rejects duplicate normalized URLs", () => {
    expect(
      claimInput.safeParse({
        ...claim,
        sources: [source, { ...source, url: "https://EXAMPLE.org/source" }],
      }).success,
    ).toBe(false);
  });
});

it("rejects null characters and URLs expanded beyond the storage limit", () => {
  expect(
    sourceUrl.safeParse("https://example.org/" + "界".repeat(300)).success,
  ).toBe(false);
  expect(
    claimInput.safeParse({
      ...claim,
      description: "A sufficiently long text with a null \0 character",
    }).success,
  ).toBe(false);
});
