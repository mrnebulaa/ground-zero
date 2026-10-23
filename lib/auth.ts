import { cookies } from "next/headers";
import { sessionCookie, hash } from "./passkeys/config";
import { readSession } from "./passkeys/sessions";
import { db } from "./db";
import { cookieName, verifySession } from "./session";
export async function currentUser() {
  const jar = await cookies();
  const secret = jar.get(sessionCookie)?.value;
  if (secret) {
    try {
      return await db.$transaction(async (tx) => {
        const { user } = await readSession(tx, hash(secret));
        return {
          id: user.id,
          displayName: user.displayName,
          role: "CONTRIBUTOR" as const,
          sessionHash: hash(secret),
        };
      });
    } catch {
      return null;
    }
  }
  const id = verifySession((await cookies()).get(cookieName)?.value);
  return id
    ? db.user.findUnique({
        where: { id },
        select: { id: true, displayName: true, role: true },
      })
    : null;
}
