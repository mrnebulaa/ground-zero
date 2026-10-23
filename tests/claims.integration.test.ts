import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { claimService } from "../lib/claims";
// Use a dedicated database: no blanket deletes, only rows belonging to this run.
if (!process.env.TEST_DATABASE_URL)
  throw new Error(
    "Set TEST_DATABASE_URL to a migrated, disposable PostgreSQL database.",
  );
const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
const service = claimService(db),
  prefix = randomUUID();
const author = { id: `${prefix}-author`, role: "CONTRIBUTOR" as const };
const outsider = { id: `${prefix}-other`, role: "CONTRIBUTOR" as const };
const reviewer = { id: `${prefix}-reviewer`, role: "REVIEWER" as const };
const ids = [author.id, outsider.id, reviewer.id];
const source = {
  url: `https://example.org/${prefix}/source`,
  attribution: "Fictional integration fixture",
  note: "Synthetic test record, not real-world evidence.",
  relation: "CONTEXT",
};
const input = {
  title: "Fictional integration claim",
  description: "This synthetic test claim does not assert a real-world fact.",
  kind: "FACTUAL",
  sources: [source],
};
beforeAll(async () => {
  for (const user of [author, outsider, reviewer])
    await db.user.create({ data: { ...user, displayName: "Test fixture" } });
});
afterAll(async () => {
  await db.auditEvent.deleteMany({ where: { actorId: { in: ids } } });
  await db.claimRevision.deleteMany({ where: { authorId: { in: ids } } });
  await db.evidence.deleteMany({ where: { submittedById: { in: ids } } });
  await db.claim.deleteMany({ where: { authorId: { in: ids } } });
  await db.source.deleteMany({
    where: { url: { startsWith: `https://example.org/${prefix}/` } },
  });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
describe("PostgreSQL evidence workflow", () => {
  it("creates claim, attributed source, revision and audit atomically", async () => {
    const claim = await service.create(author, {
      ...input,
      status: "SUPPORTED",
    });
    expect(claim.status).toBe("UNREVIEWED");
    expect(await db.evidence.count({ where: { claimId: claim.id } })).toBe(1);
    expect(await db.claimRevision.count({ where: { claimId: claim.id } })).toBe(
      1,
    );
    expect(await db.auditEvent.count({ where: { claimId: claim.id } })).toBe(1);
  });
  it("rejects anonymous writes and unauthorized reviews or corrections", async () => {
    await expect(service.create(null, input)).rejects.toThrow("Sign in");
    const claim = await service.create(author, input);
    await expect(service.attach(null, claim.id, source)).rejects.toThrow(
      "Sign in",
    );
    await expect(
      service.review(author, claim.id, {
        status: "SUPPORTED",
        version: 1,
        reason: "Unauthorized review attempt",
      }),
    ).rejects.toThrow("Only reviewers");
    await expect(
      service.revise(outsider, claim.id, {
        ...input,
        version: 1,
        reason: "Unauthorized correction attempt",
      }),
    ).rejects.toThrow("Only the author");
    expect(await db.claimRevision.count({ where: { claimId: claim.id } })).toBe(
      1,
    );
  });
  it("preserves snapshots, resets review on corrections and rejects stale updates", async () => {
    const claim = await service.create(author, input);
    await service.review(reviewer, claim.id, {
      status: "SUPPORTED",
      version: 1,
      reason: "Synthetic review for testing only.",
    });
    await service.revise(author, claim.id, {
      ...input,
      title: "Corrected fictional claim",
      version: 2,
      reason: "Clarified the synthetic statement scope.",
    });
    const updated = await db.claim.findUniqueOrThrow({
      where: { id: claim.id },
      include: { revisions: { orderBy: { version: "asc" } } },
    });
    expect(updated.status).toBe("UNREVIEWED");
    expect(updated.version).toBe(3);
    expect(updated.revisions.map((r) => r.status)).toEqual([
      "UNREVIEWED",
      "SUPPORTED",
      "UNREVIEWED",
    ]);
    expect(updated.revisions[0].title).toBe(input.title);
    await expect(
      service.review(reviewer, claim.id, {
        status: "REFUTED",
        version: 2,
        reason: "Stale reviewer submission.",
      }),
    ).rejects.toThrow("claim changed");
  });
  it("rejects duplicate evidence without partial revision or audit writes", async () => {
    const claim = await service.create(author, input);
    await expect(service.attach(author, claim.id, source)).rejects.toThrow(
      "already attached",
    );
    expect(
      (await db.claim.findUniqueOrThrow({ where: { id: claim.id } })).version,
    ).toBe(1);
    expect(await db.auditEvent.count({ where: { claimId: claim.id } })).toBe(1);
    await service.attach(author, claim.id, {
      ...source,
      url: `https://example.org/${prefix}/additional`,
    });
    expect(await db.claimRevision.count({ where: { claimId: claim.id } })).toBe(
      2,
    );
  });
  it("rolls back evidence when the claim does not exist", async () => {
    const url = `https://example.org/${prefix}/rollback`;
    await expect(
      service.attach(author, "nonexistent", { ...source, url }),
    ).rejects.toThrow();
    expect(await db.source.findUnique({ where: { url } })).toBeNull();
  });
  it("allows only one of two concurrent reviews at the same version", async () => {
    const claim = await service.create(author, input);
    const results = await Promise.allSettled(
      ["SUPPORTED", "DISPUTED"].map((status) =>
        service.review(reviewer, claim.id, {
          status,
          version: 1,
          reason: "Concurrent synthetic review.",
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.claimRevision.count({ where: { claimId: claim.id } })).toBe(
      2,
    );
  });
});

it("concurrent attachments preserve consecutive history and reset a previous review", async () => {
  const claim = await service.create(author, input);
  await service.review(reviewer, claim.id, {
    status: "SUPPORTED",
    version: 1,
    reason: "Synthetic test review only.",
  });
  await Promise.all(
    ["one", "two"].map((suffix) =>
      service.attach(author, claim.id, {
        ...source,
        url: `https://example.org/${prefix}/${suffix}`,
      }),
    ),
  );
  const updated = await db.claim.findUniqueOrThrow({
    where: { id: claim.id },
    include: { revisions: { orderBy: { version: "asc" } } },
  });
  expect(updated.status).toBe("UNREVIEWED");
  expect(updated.revisions.map((r) => r.version)).toEqual([1, 2, 3, 4]);
  expect(await db.evidence.count({ where: { claimId: claim.id } })).toBe(3);
  expect(await db.auditEvent.count({ where: { claimId: claim.id } })).toBe(4);
});
it("concurrent duplicate attachments commit exactly once", async () => {
  const claim = await service.create(author, input);
  const data = {
    ...source,
    url: `https://example.org/${prefix}/duplicate-race`,
  };
  const results = await Promise.allSettled([
    service.attach(author, claim.id, data),
    service.attach(author, claim.id, data),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.evidence.count({ where: { claimId: claim.id } })).toBe(2);
  expect(await db.claimRevision.count({ where: { claimId: claim.id } })).toBe(
    2,
  );
  expect(await db.auditEvent.count({ where: { claimId: claim.id } })).toBe(2);
});
it("concurrent submissions reuse new source URLs in opposite input order", async () => {
  const sources = ["shared-a", "shared-b"].map((suffix) => ({
    ...source,
    url: `https://example.org/${prefix}/${suffix}`,
  }));
  const claims = await Promise.all([
    service.create(author, { ...input, sources }),
    service.create(author, { ...input, sources: [...sources].reverse() }),
  ]);
  expect(claims).toHaveLength(2);
  expect(
    await db.source.count({
      where: { url: { in: sources.map((s) => s.url) } },
    }),
  ).toBe(2);
});
it("enforces audit claim referential integrity", async () => {
  await expect(
    db.auditEvent.create({
      data: { actorId: author.id, action: "TEST", claimId: "nonexistent" },
    }),
  ).rejects.toThrow();
});
