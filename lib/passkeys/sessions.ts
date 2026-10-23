import { Prisma, SessionKind } from "@prisma/client";
import { AuthError, hash, token } from "./config";
export type Tx = Prisma.TransactionClient;
export async function lockUser(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;
  return tx.user.findUniqueOrThrow({ where: { id } });
}
export async function readSession(
  tx: Tx,
  tokenHash: string,
  kinds: SessionKind[] = ["MEMBER"],
  fresh = false,
) {
  const found = await tx.authSession.findUnique({ where: { tokenHash } });
  if (!found) throw new AuthError("Sign in with a passkey to continue.");
  const user = await lockUser(tx, found.userId);
  const session = await tx.authSession.findUniqueOrThrow({
    where: { tokenHash },
  });
  const now = Date.now();
  if (
    session.revokedAt ||
    session.expiresAt.getTime() <= now ||
    (session.kind === "MEMBER" &&
      session.lastSeenAt.getTime() + 86400000 <= now) ||
    session.version !== user.authVersion ||
    !kinds.includes(session.kind) ||
    user.accountState === "SUSPENDED" ||
    (session.kind === "MEMBER" && user.accountState !== "ACTIVE") ||
    (session.kind !== "MEMBER" && user.accountState !== "RECOVERING")
  )
    throw new AuthError("Session expired or revoked. Sign in again.");
  if (session.kind === "RECOVERY") {
    const attempt = session.recoveryId
      ? await tx.recoveryAttempt.findUnique({
          where: { id: session.recoveryId },
        })
      : null;
    if (
      !attempt ||
      !attempt.active ||
      attempt.userId !== user.id ||
      attempt.expiresAt.getTime() <= now
    )
      throw new AuthError(
        "Recovery attempt expired. Use an original passkey to contest or start again with an unused code.",
      );
  }
  if (fresh && session.createdAt.getTime() + 15 * 60000 <= now)
    throw new AuthError("Sign in again for a fresh passkey check.");
  await tx.authSession.update({
    where: { tokenHash },
    data: { lastSeenAt: new Date() },
  });
  return { user, session };
}
export async function issueSession(
  tx: Tx,
  userId: string,
  version: number,
  kind: SessionKind,
  recoveryId?: string,
  authenticatedAt = new Date(),
  expiresAt?: Date,
) {
  const secret = token();
  await tx.authSession.create({
    data: {
      tokenHash: hash(secret),
      userId,
      version,
      kind,
      recoveryId,
      createdAt: authenticatedAt,
      expiresAt: new Date(
        Math.min(
          authenticatedAt.getTime() + (kind === "MEMBER" ? 7 : 3) * 86400000,
          expiresAt?.getTime() ?? Infinity,
        ),
      ),
    },
  });
  return secret;
}
export async function invalidate(tx: Tx, userId: string) {
  const user = await tx.user.update({
    where: { id: userId },
    data: { authVersion: { increment: 1 } },
  });
  await tx.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return user;
}
