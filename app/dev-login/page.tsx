import { currentUser } from "@/lib/auth";
import { devAuthEnabled } from "@/lib/session";
import { LoginForm } from "@/app/forms";
import { logout } from "@/app/actions";
export const dynamic = "force-dynamic";
export default async function DevLogin() {
  const user = await currentUser();
  return (
    <section className="narrow">
      <p className="eyebrow">Developer tools</p>
      <h1>Local access</h1>
      <p className="intro">
        A shared-secret sign-in for local testing. It is unavailable in
        production and is not a public account system.
      </p>
      {user ? (
        <div className="panel">
          <p>
            Signed in as {user.displayName} ({user.role.toLowerCase()}).
          </p>
          <form action={logout}>
            <button>Sign out</button>
          </form>
        </div>
      ) : devAuthEnabled() ? (
        <LoginForm />
      ) : (
        <div className="panel">
          <h2>Development authentication is disabled</h2>
          <p>
            Set DEV_AUTH_ENABLED=true and a random DEV_AUTH_SECRET of at least
            32 characters in .env, then run npm run dev. See the README.
          </p>
        </div>
      )}
    </section>
  );
}
