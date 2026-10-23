import { Prisma, PrismaClient, Role } from "@prisma/client";
import {
  claimInput,
  idInput,
  reviewInput,
  revisionInput,
  sourceInput,
} from "./validation";
export class ClaimError extends Error {}
type Actor = { id: string; role: Role } | null;
export function requireActor(actor: Actor) {
  if (!actor)
    throw new ClaimError(
      "Sign in with development authentication to contribute.",
    );
  return actor;
}
export function requireReviewer(actor: Actor) {
  const user = requireActor(actor);
  if (user.role !== "REVIEWER")
    throw new ClaimError("Only reviewers can change review status.");
  return user;
}
function snapshot(
  claim: {
    id: string;
    version: number;
    title: string;
    description: string;
    kind: Prisma.ClaimRevisionCreateManyInput["kind"];
    status: Prisma.ClaimRevisionCreateManyInput["status"];
  },
  actorId: string,
  reason: string,
) {
  return {
    claimId: claim.id,
    version: claim.version,
    title: claim.title,
    description: claim.description,
    kind: claim.kind,
    status: claim.status,
    authorId: actorId,
    reason,
  };
}
export function claimService(db: PrismaClient) {
  return {
    async create(actor: Actor, input: unknown) {
      const user = requireActor(actor),
        data = claimInput.parse(input);
      return db.$transaction(async (tx) => {
        const { sources, ...fields } = data;
        const claim = await tx.claim.create({
          data: { ...fields, authorId: user.id },
        });
        for (const item of sources) {
          const { url, ...details } = item;
          const source = await tx.source.upsert({
            where: { url },
            create: { url },
            update: {},
          });
          await tx.evidence.create({
            data: {
              ...details,
              claimId: claim.id,
              sourceId: source.id,
              submittedById: user.id,
            },
          });
        }
        await tx.claimRevision.create({
          data: snapshot(
            claim,
            user.id,
            "Initial submission; sources have not been independently reviewed.",
          ),
        });
        await tx.auditEvent.create({
          data: {
            actorId: user.id,
            action: "CLAIM_CREATED",
            claimId: claim.id,
          },
        });
        return claim;
      });
    },
    async attach(actor: Actor, claimId: string, input: unknown) {
      const user = requireActor(actor),
        id = idInput.parse(claimId),
        data = sourceInput.parse(input);
      return db.$transaction(async (tx) => {
        const { url, ...details } = data;
        const source = await tx.source.upsert({
          where: { url },
          create: { url },
          update: {},
        });
        if (
          await tx.evidence.findUnique({
            where: { claimId_sourceId: { claimId: id, sourceId: source.id } },
          })
        )
          throw new ClaimError("This source is already attached to the claim.");
        await tx.evidence.create({
          data: {
            ...details,
            claimId: id,
            sourceId: source.id,
            submittedById: user.id,
          },
        });
        // Updating the row serializes evidence additions with revisions and reviews.
        // New evidence reopens review so an old verdict does not cover new material.
        const claim = await tx.claim.update({
          where: { id },
          data: { version: { increment: 1 }, status: "UNREVIEWED" },
        });
        await tx.claimRevision.create({
          data: snapshot(
            claim,
            user.id,
            `Evidence added: ${url}. Review reset to Unreviewed.`,
          ),
        });
        await tx.auditEvent.create({
          data: { actorId: user.id, action: "EVIDENCE_ATTACHED", claimId: id },
        });
      });
    },
    async revise(actor: Actor, claimId: string, input: unknown) {
      const user = requireActor(actor),
        id = idInput.parse(claimId),
        data = revisionInput.parse(input);
      return db.$transaction(async (tx) => {
        const existing = await tx.claim.findUniqueOrThrow({ where: { id } });
        if (existing.authorId !== user.id && user.role !== "REVIEWER")
          throw new ClaimError(
            "Only the author or a reviewer may correct this claim.",
          );
        const { version, reason, ...fields } = data;
        const result = await tx.claim.updateMany({
          where: { id, version },
          data: { ...fields, status: "UNREVIEWED", version: { increment: 1 } },
        });
        if (!result.count)
          throw new ClaimError(
            "The claim changed. Reload before submitting again.",
          );
        const claim = await tx.claim.findUniqueOrThrow({ where: { id } });
        await tx.claimRevision.create({
          data: snapshot(claim, user.id, reason),
        });
        await tx.auditEvent.create({
          data: { actorId: user.id, action: "CLAIM_CORRECTED", claimId: id },
        });
      });
    },
    async review(actor: Actor, claimId: string, input: unknown) {
      const user = requireReviewer(actor),
        id = idInput.parse(claimId),
        data = reviewInput.parse(input);
      return db.$transaction(async (tx) => {
        const result = await tx.claim.updateMany({
          where: { id, version: data.version },
          data: { status: data.status, version: { increment: 1 } },
        });
        if (!result.count)
          throw new ClaimError(
            "The claim changed. Reload before submitting again.",
          );
        const claim = await tx.claim.findUniqueOrThrow({ where: { id } });
        await tx.claimRevision.create({
          data: snapshot(claim, user.id, data.reason),
        });
        await tx.auditEvent.create({
          data: { actorId: user.id, action: "REVIEW_CHANGED", claimId: id },
        });
      });
    },
  };
}
