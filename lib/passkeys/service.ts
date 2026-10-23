import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { z } from "zod";
import {
  AuthError,
  config,
  hash,
  recoveryHash,
  token,
  usernameInput,
} from "./config";
import { invalidate, issueSession, lockUser, readSession } from "./sessions";
const labelInput = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[^\x00-\x1f]+$/);
const envelope = z
  .object({
    id: z.string().min(1).max(2048),
    response: z.object({}).passthrough(),
    type: z.literal("public-key"),
  })
  .passthrough();
export function authService(db: PrismaClient) {
  return {
    async rateLimit(key: string, limit = 60, windowMs = 60000) {
      const bucket = hash(key + ":" + Math.floor(Date.now() / windowMs));
      const result = await db.authRateBucket.upsert({
        where: { key: bucket },
        create: {
          key: bucket,
          count: 1,
          expiresAt: new Date(Date.now() + windowMs),
        },
        update: { count: { increment: 1 } },
      });
      if (result.count > limit)
        throw new AuthError("Too many attempts. Try again later.");
    },
    async begin(
      purpose: string,
      input: Record<string, unknown>,
      secret?: string,
    ) {
      const { rpID } = config();
      if (
        ![
          "register",
          "login",
          "add",
          "recover-enroll",
          "recover-finish",
        ].includes(purpose)
      )
        throw new AuthError("Invalid ceremony.");
      if (
        purpose === "register" &&
        process.env.AUTH_REGISTRATION_ENABLED !== "true"
      )
        throw new AuthError("Registration is disabled.");
      const binding = token();
      return db.$transaction(async (tx) => {
        // TTL checks also run during consumption; cleanup never controls validity.
        await tx.authCeremony.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });
        let userId: string = randomUUID(),
          version = 0,
          username: string | undefined;
        let sessionHash: string | undefined;
        const label =
          purpose === "register" ||
          purpose === "add" ||
          purpose === "recover-enroll"
            ? labelInput.parse(input.label)
            : "Passkey";
        if (purpose === "register") {
          username = usernameInput.parse(input.username);
          if (input.acceptRules !== true)
            throw new AuthError(
              "Accept the community rules and recovery limitations.",
            );
          if (await tx.user.findUnique({ where: { username } }))
            throw new AuthError("Username unavailable.");
        } else if (purpose !== "login") {
          sessionHash = hash(secret ?? "");
          const { user, session } = await readSession(
            tx,
            sessionHash,
            purpose === "add" ? ["MEMBER"] : ["RECOVERY"],
            purpose === "add",
          );
          userId = user.id;
          version = user.authVersion;
          if (purpose !== "add") {
            const attempt = await tx.recoveryAttempt.findUniqueOrThrow({
              where: { id: session.recoveryId! },
            });
            if (!attempt.active || attempt.expiresAt <= new Date())
              throw new AuthError("Recovery attempt expired.");
            if (purpose === "recover-finish" && attempt.holdUntil > new Date())
              throw new AuthError("The recovery delay has not elapsed.");
            if (
              purpose === "recover-enroll" &&
              (await tx.passkey.count({ where: { recoveryId: attempt.id } }))
            )
              throw new AuthError(
                "A replacement is already enrolled. Continue recovery.",
              );
          }
          if (
            purpose === "add" &&
            (await tx.passkey.count({ where: { userId } })) >= 10
          )
            throw new AuthError("At most ten passkeys are allowed.");
        }
        const create = ["register", "add", "recover-enroll"].includes(purpose);
        const existing =
          purpose === "add"
            ? await tx.passkey.findMany({
                where: { userId, pending: false },
                select: { id: true },
              })
            : [];
        const options = create
          ? await generateRegistrationOptions({
              rpName: "Ground Zero",
              rpID,
              userID: Buffer.from(userId),
              userName: username ?? "Ground Zero member",
              attestationType: "none",
              authenticatorSelection: {
                residentKey: "required",
                userVerification: "required",
              },
              excludeCredentials: existing,
              supportedAlgorithmIDs: [-7, -257],
            })
          : await generateAuthenticationOptions({
              rpID,
              userVerification: "required",
            });
        await tx.authCeremony.create({
          data: {
            bindingHash: hash(binding),
            challenge: options.challenge,
            purpose,
            userId,
            username,
            sessionHash,
            version,
            label,
            expiresAt: new Date(Date.now() + 300000),
          },
        });
        return { options, binding };
      });
    },
    async finish(binding: string, input: unknown, secret?: string) {
      const { rpID, origin } = config();
      const response = envelope.parse(input);
      return db.$transaction(
        async (tx) => {
          const ceremony = await tx.authCeremony.findUnique({
            where: { bindingHash: hash(binding) },
          });
          if (!ceremony || ceremony.expiresAt <= new Date())
            throw new AuthError("Ceremony expired. Start again.");
          // Conditional delete serializes concurrent submissions. Failure rolls back all writes.
          const used = await tx.authCeremony.deleteMany({
            where: { id: ceremony.id },
          });
          if (!used.count) throw new AuthError("Ceremony already used.");
          const purpose = ceremony.purpose;
          if (
            ceremony.sessionHash &&
            ceremony.sessionHash !== hash(secret ?? "")
          )
            throw new AuthError("Ceremony belongs to another session.");
          let userId = ceremony.userId;
          let recoveryId: string | undefined;
          if (purpose !== "register" && purpose !== "login") {
            const { user, session } = await readSession(
              tx,
              ceremony.sessionHash!,
              purpose === "add" ? ["MEMBER"] : ["RECOVERY"],
              purpose === "add",
            );
            if (user.authVersion !== ceremony.version)
              throw new AuthError("Account changed. Start again.");
            recoveryId = session.recoveryId ?? undefined;
            if (recoveryId) {
              const attempt = await tx.recoveryAttempt.findUniqueOrThrow({
                where: { id: recoveryId },
              });
              if (
                !attempt.active ||
                attempt.expiresAt <= new Date() ||
                (purpose === "recover-finish" && attempt.holdUntil > new Date())
              )
                throw new AuthError("Recovery is not ready or expired.");
            }
          }
          if (["register", "add", "recover-enroll"].includes(purpose)) {
            if (
              purpose === "register" &&
              process.env.AUTH_REGISTRATION_ENABLED !== "true"
            )
              throw new AuthError("Registration is disabled.");
            const result = await verifyRegistrationResponse({
              response: response as unknown as RegistrationResponseJSON,
              expectedChallenge: ceremony.challenge,
              expectedOrigin: origin,
              expectedRPID: rpID,
              requireUserVerification: true,
              supportedAlgorithmIDs: [-7, -257],
            });
            if (!result.verified)
              throw new AuthError("Passkey verification failed.");
            const info = result.registrationInfo;
            if (purpose === "register")
              await tx.user.create({
                data: {
                  id: userId,
                  username: ceremony.username!,
                  displayName: ceremony.username!,
                },
              });
            if (
              purpose === "recover-enroll" &&
              (await tx.passkey.count({ where: { recoveryId } }))
            )
              throw new AuthError("Replacement already enrolled.");
            if (
              purpose === "add" &&
              (await tx.passkey.count({ where: { userId } })) >= 10
            )
              throw new AuthError("At most ten passkeys are allowed.");
            await tx.passkey.create({
              data: {
                id: info.credential.id,
                userId,
                publicKey: Buffer.from(info.credential.publicKey),
                counter: BigInt(info.credential.counter),
                label: ceremony.label,
                backedUp: info.credentialBackedUp,
                pending: purpose === "recover-enroll",
                recoveryId,
              },
            });
            if (purpose === "recover-enroll")
              return {
                message:
                  "Replacement enrolled. After the hold, prove this passkey to finish recovery.",
              };
            const user = await invalidate(tx, userId);
            return {
              session: await issueSession(
                tx,
                userId,
                user.authVersion,
                "MEMBER",
              ),
            };
          }
          const credential = await tx.passkey.findUnique({
            where: { id: response.id },
          });
          if (!credential) throw new AuthError("Passkey verification failed.");
          userId = credential.userId;
          const user = await lockUser(tx, userId);
          // Re-read after locking against concurrent credential removal/counter updates.
          const key = await tx.passkey.findUniqueOrThrow({
            where: { id: credential.id },
          });
          if (
            user.accountState === "SUSPENDED" ||
            !user.username ||
            (purpose === "login" && key.pending) ||
            (purpose === "recover-finish" &&
              (!key.pending ||
                key.recoveryId !== recoveryId ||
                userId !== ceremony.userId))
          )
            throw new AuthError("Passkey cannot be used for this operation.");
          const assertion = response as unknown as AuthenticationResponseJSON;
          if (
            assertion.response.userHandle !==
            Buffer.from(userId).toString("base64url")
          )
            throw new AuthError("Passkey account mismatch.");
          const result = await verifyAuthenticationResponse({
            response: assertion,
            expectedChallenge: ceremony.challenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            requireUserVerification: true,
            credential: {
              id: key.id,
              publicKey: new Uint8Array(key.publicKey),
              counter: Number(key.counter),
            },
          });
          if (!result.verified)
            throw new AuthError("Passkey verification failed.");
          await tx.passkey.update({
            where: { id: key.id },
            data: {
              counter: BigInt(result.authenticationInfo.newCounter),
              backedUp: result.authenticationInfo.credentialBackedUp,
            },
          });
          if (purpose === "recover-finish") {
            await tx.passkey.deleteMany({
              where: { userId, id: { not: key.id } },
            });
            await tx.passkey.update({
              where: { id: key.id },
              data: { pending: false, recoveryId: null },
            });
            await tx.recoveryCode.deleteMany({ where: { userId } });
            await tx.recoveryAttempt.update({
              where: { id: recoveryId! },
              data: { active: false },
            });
            await tx.user.update({
              where: { id: userId },
              data: { accountState: "ACTIVE", role: "CONTRIBUTOR" },
            });
            const updated = await invalidate(tx, userId);
            return {
              session: await issueSession(
                tx,
                userId,
                updated.authVersion,
                "MEMBER",
              ),
            };
          }
          if (secret)
            await tx.authSession.updateMany({
              where: { tokenHash: hash(secret) },
              data: { revokedAt: new Date() },
            });
          const kind =
            user.accountState === "RECOVERING" ? "CONTEST" : "MEMBER";
          return {
            session: await issueSession(tx, userId, user.authVersion, kind),
          };
        },
        { timeout: 15000 },
      );
    },
    async recover(username: unknown, code: unknown) {
      const name = usernameInput.parse(username);
      const value = z
        .string()
        .regex(/^[a-f0-9]{32}$/)
        .parse(code);
      await this.rateLimit("recover:" + name, 5, 900000);
      return db.$transaction(async (tx) => {
        const found = await tx.user.findUnique({ where: { username: name } });
        if (!found)
          throw new AuthError(
            "Recovery unavailable. Check your username and unused code.",
          );
        const user = await lockUser(tx, found.id);
        if (user.accountState === "SUSPENDED")
          throw new AuthError("Recovery unavailable.");
        if (
          await tx.recoveryAttempt.count({
            where: {
              userId: user.id,
              active: true,
              expiresAt: { gt: new Date() },
            },
          })
        )
          throw new AuthError(
            "Recovery unavailable. An attempt may already be pending.",
          );
        const used = await tx.recoveryCode.deleteMany({
          where: { userId: user.id, hash: recoveryHash(user.id, value) },
        });
        if (used.count !== 1)
          throw new AuthError(
            "Recovery unavailable. Check your username and unused code.",
          );
        await tx.passkey.deleteMany({
          where: { userId: user.id, pending: true },
        });
        await tx.recoveryAttempt.updateMany({
          where: { userId: user.id, active: true },
          data: { active: false },
        });
        const attempt = await tx.recoveryAttempt.create({
          data: {
            userId: user.id,
            holdUntil: new Date(Date.now() + config().delay * 3600000),
            expiresAt: new Date(Date.now() + 72 * 3600000),
          },
        });
        await tx.user.update({
          where: { id: user.id },
          data: { accountState: "RECOVERING", role: "CONTRIBUTOR" },
        });
        const updated = await invalidate(tx, user.id);
        return {
          session: await issueSession(
            tx,
            user.id,
            updated.authVersion,
            "RECOVERY",
            attempt.id,
          ),
        };
      });
    },
    async codes(secret: string) {
      return db.$transaction(async (tx) => {
        const { user } = await readSession(tx, hash(secret), ["MEMBER"], true);
        const codes = Array.from({ length: 8 }, () =>
          randomBytes(16).toString("hex"),
        );
        await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
        await tx.recoveryCode.createMany({
          data: codes.map((code) => ({
            userId: user.id,
            hash: recoveryHash(user.id, code),
          })),
        });
        return { codes };
      });
    },
    async remove(secret: string, id: string) {
      return db.$transaction(async (tx) => {
        const { user, session } = await readSession(
          tx,
          hash(secret),
          ["MEMBER"],
          true,
        );
        if (
          (await tx.passkey.count({
            where: { userId: user.id, pending: false },
          })) <= 1
        )
          throw new AuthError(
            "Add another passkey before removing the last one.",
          );
        const removed = await tx.passkey.deleteMany({
          where: { id, userId: user.id, pending: false },
        });
        if (!removed.count)
          throw new AuthError("Passkey not found for this account.");
        const updated = await invalidate(tx, user.id);
        return {
          session: await issueSession(
            tx,
            user.id,
            updated.authVersion,
            "MEMBER",
            undefined,
            session.createdAt,
          ),
        };
      });
    },
    async cancel(secret: string) {
      return db.$transaction(async (tx) => {
        const { user } = await readSession(tx, hash(secret), ["CONTEST"], true);
        await tx.passkey.deleteMany({
          where: { userId: user.id, pending: true },
        });
        await tx.recoveryAttempt.updateMany({
          where: { userId: user.id, active: true },
          data: { active: false },
        });
        await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
        await tx.user.update({
          where: { id: user.id },
          data: { accountState: "ACTIVE" },
        });
        await invalidate(tx, user.id);
        return {
          message:
            "Recovery cancelled; codes and sessions revoked. Sign in again with your original passkey.",
        };
      });
    },
    async logout(secret: string, all = false) {
      if (!all) {
        await db.authSession.updateMany({
          where: { tokenHash: hash(secret) },
          data: { revokedAt: new Date() },
        });
        return;
      }
      await db.$transaction(async (tx) => {
        const { user } = await readSession(tx, hash(secret));
        await invalidate(tx, user.id);
      });
    },
    async account(secret: string) {
      return db.$transaction(async (tx) => {
        const { user, session } = await readSession(tx, hash(secret), [
          "MEMBER",
          "RECOVERY",
          "CONTEST",
        ]);
        return {
          username: user.username,
          kind: session.kind,
          keys:
            session.kind === "MEMBER"
              ? await tx.passkey.findMany({
                  where: { userId: user.id, pending: false },
                  select: { id: true, label: true, createdAt: true },
                })
              : [],
          codeCount:
            session.kind === "MEMBER"
              ? await tx.recoveryCode.count({ where: { userId: user.id } })
              : 0,
          attempt:
            user.accountState === "RECOVERING"
              ? await tx.recoveryAttempt.findFirst({
                  where: { userId: user.id, active: true },
                  select: { holdUntil: true, expiresAt: true },
                })
              : null,
        };
      });
    },
  };
}
