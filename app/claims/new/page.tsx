import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { NewClaimForm } from "@/app/forms";
export const dynamic = "force-dynamic";
export default async function NewClaim() {
  const user = await currentUser();
  return (
    <section className="narrow">
      <p className="eyebrow">Build an inspectable record</p>
      <h1>Submit a claim</h1>
      <p className="intro">
        Be specific. Include scope, uncertainty, and the original source where
        possible. New claims begin as Unreviewed.
      </p>
      <div className="notice">
        All submitted text and source URLs are public. Do not include personal
        information, credentials, or private documents.
      </div>
      {user ? (
        <NewClaimForm />
      ) : (
        <div className="panel">
          <h2>Local access required</h2>
          <p>
            <Link href="/login">Sign in with a passkey</Link> to contribute.
            Registration is default-off. Configure development authentication in
            your local environment to contribute.
          </p>
          <Link href="/dev-login">Development sign-in →</Link>
        </div>
      )}
    </section>
  );
}
