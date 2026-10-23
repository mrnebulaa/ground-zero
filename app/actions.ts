"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { ClaimError, claimService } from "@/lib/claims";
import { cookieName, createSession, matchesSecret } from "@/lib/session";
export type FormState = { error: string };
const service = claimService(db);
function message(error: unknown): FormState {
  if (error instanceof ZodError)
    return {
      error: error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(" · "),
    };
  if (error instanceof ClaimError) return { error: error.message };
  return {
    error:
      "Unable to save. Check the database connection, reload the claim, and try again. A source URL can only be attached once.",
  };
}
function source(form: FormData, suffix = "") {
  return {
    url: form.get(`url${suffix}`),
    attribution: form.get(`attribution${suffix}`),
    note: form.get(`note${suffix}`),
    relation: form.get(`relation${suffix}`),
  };
}
export async function submitClaim(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  let id: string;
  try {
    const sources = [source(form)];
    if (form.get("url2")) sources.push(source(form, "2"));
    const claim = await service.create(await currentUser(), {
      title: form.get("title"),
      description: form.get("description"),
      kind: form.get("kind"),
      sources,
    });
    id = claim.id;
  } catch (error) {
    return message(error);
  }
  revalidatePath("/");
  redirect(`/claims/${id}`);
}
export async function attachEvidence(
  id: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await service.attach(await currentUser(), id, source(form));
  } catch (error) {
    return message(error);
  }
  revalidatePath(`/claims/${id}`);
  revalidatePath("/");
  redirect(`/claims/${id}`);
}
export async function correctClaim(
  id: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await service.revise(await currentUser(), id, Object.fromEntries(form));
  } catch (error) {
    return message(error);
  }
  revalidatePath(`/claims/${id}`);
  revalidatePath("/");
  redirect(`/claims/${id}`);
}
export async function reviewClaim(
  id: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await service.review(await currentUser(), id, Object.fromEntries(form));
  } catch (error) {
    return message(error);
  }
  revalidatePath(`/claims/${id}`);
  revalidatePath("/");
  redirect(`/claims/${id}`);
}
export async function login(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  if (!matchesSecret(String(form.get("secret") ?? "")))
    return {
      error: "Development sign-in is disabled or the secret is incorrect.",
    };
  const reviewer = form.get("role") === "REVIEWER";
  try {
    const id = reviewer ? "local-reviewer" : "local-contributor";
    const user = await db.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        displayName: reviewer ? "Local reviewer" : "Local contributor",
        role: reviewer ? "REVIEWER" : "CONTRIBUTOR",
      },
    });
    (await cookies()).set(cookieName, createSession(user.id), {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
      maxAge: 8 * 60 * 60,
    });
  } catch {
    return {
      error:
        "Could not sign in. Check that the local database is running and migrated.",
    };
  }
  redirect("/");
}
export async function logout() {
  (await cookies()).delete(cookieName);
  redirect("/");
}
