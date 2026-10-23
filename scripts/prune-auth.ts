import { PrismaClient } from "@prisma/client";
import { lockUser } from "../lib/passkeys/sessions";
const db = new PrismaClient();
async function main() {
  try {
    const now = new Date();
    await db.authCeremony.deleteMany({ where: { expiresAt: { lt: now } } });
    await db.authRateBucket.deleteMany({ where: { expiresAt: { lt: now } } });
    await db.authSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { lt: new Date(Date.now() - 86400000) } },
          {
            kind: "MEMBER",
            lastSeenAt: { lt: new Date(Date.now() - 86400000) },
          },
        ],
      },
    });
    const attempts = await db.recoveryAttempt.findMany({
      where: { expiresAt: { lt: now } },
      select: { id: true, userId: true },
    });
    for (const attempt of attempts)
      await db.$transaction(async (tx) => {
        await lockUser(tx, attempt.userId);
        await tx.passkey.deleteMany({
          where: { recoveryId: attempt.id, pending: true },
        });
        await tx.recoveryAttempt.deleteMany({ where: { id: attempt.id } });
        // Do not silently reactivate a recovering account or restore any old session.
      });
    console.log("Expired authentication records pruned.");
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Authentication cleanup failed; inspect database availability.",
  );
  process.exitCode = 1;
});
