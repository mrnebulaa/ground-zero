import { cookies } from "next/headers";
import { db } from "./db";
import { cookieName, verifySession } from "./session";
export async function currentUser() {
  const id = verifySession((await cookies()).get(cookieName)?.value);
  return id
    ? db.user.findUnique({
        where: { id },
        select: { id: true, displayName: true, role: true },
      })
    : null;
}
