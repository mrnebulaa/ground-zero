"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
type Account = {
  username: string;
  kind: string;
  keys: { id: string; label: string }[];
  codeCount: number;
  replacementEnrolled: boolean;
  attempt: { holdUntil: string; expiresAt: string } | null;
};
function displayTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date(value));
}
async function api(operation: string, body: object = {}) {
  const response = await fetch(`/api/auth/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
export default function AuthPanel({
  mode,
  registrationEnabled = false,
}: {
  mode: "account" | "login" | "register" | "recover";
  registrationEnabled?: boolean;
}) {
  const [account, setAccount] = useState<Account | null>(null);
  const [username, setUsername] = useState("");
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (mode === "account")
      api("account")
        .then(setAccount)
        .catch((e) => setMessage(e.message));
  }, [mode]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  }
  async function ceremony(purpose: string) {
    const { options } = await api("begin", {
      purpose,
      username,
      label,
      acceptRules: accepted,
    });
    const response = ["register", "add", "recover-enroll"].includes(purpose)
      ? await startRegistration({ optionsJSON: options })
      : await startAuthentication({ optionsJSON: options });
    const result = await api("finish", { response });
    if (purpose === "recover-enroll") {
      setMessage(result.message);
      setAccount(await api("account"));
    } else window.location.assign("/account");
  }
  const labelField = (
    <label>
      Passkey label
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        required
        maxLength={60}
        placeholder="For example: personal security key"
      />
    </label>
  );
  return (
    <section className="narrow">
      <h1>
        {mode === "account"
          ? "Account security"
          : mode === "register"
            ? "Create an account"
            : mode === "recover"
              ? "Recover account"
              : "Sign in"}
      </h1>
      <p>
        Passkeys use your device or security key. Ground Zero receives no device
        PIN, biometric record, password, or identity document.
      </p>
      <nav aria-label="Account navigation">
        <Link href="/login">Sign in</Link>
        <Link href="/register">Register</Link>
        <Link href="/recover">Recover</Link>
        <Link href="/account">Security</Link>
      </nav>
      <p role="status" aria-live="polite" className="form-error">
        {message}
      </p>
      {mode === "register" &&
        (!registrationEnabled ? (
          <p>Registration is disabled.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => ceremony("register"));
            }}
          >
            <label>
              Public username
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]+"
                autoComplete="username"
              />
            </label>
            <p>
              3–30 letters, numbers, or underscores. Your public username is
              persistent and cannot be renamed here.
            </p>
            {labelField}
            <label className="checkbox-label">
              <input
                type="checkbox"
                required
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              I agree to the community rules: no harassment, threats,
              impersonation, or private personal records. I understand that
              losing all passkeys and offline codes can permanently lose access.
            </label>
            <button disabled={busy}>Register passkey</button>
          </form>
        ))}
      {mode === "login" && (
        <>
          <p>
            Sign in again before changing passkeys or generating codes. If
            recovery is pending, an original passkey can only contest it. An
            enrolled replacement resumes the restricted recovery attempt; it
            cannot grant ordinary access until you finish after the hold.
          </p>
          <button disabled={busy} onClick={() => run(() => ceremony("login"))}>
            Sign in with passkey
          </button>
        </>
      )}
      {mode === "recover" && (
        <>
          <h2>Resume an existing recovery</h2>
          <p>
            Already enrolled a replacement? Use it to resume after signing out
            or losing cookies. This preserves the original hold and expiry; no
            additional code is consumed.
          </p>
          <button disabled={busy} onClick={() => run(() => ceremony("login"))}>
            Resume with replacement passkey
          </button>
          <p>
            To contest recovery instead,{" "}
            <Link href="/login">sign in with an original passkey</Link>.
          </p>
          <h2>Start a new recovery</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api("recover", { username, code: code.trim() });
                setCode("");
                window.location.assign("/account");
              });
            }}
          >
            <p>
              Use one offline code. This revokes existing sessions, starts a
              recovery hold (normally 24 hours), and requires a replacement
              passkey. This replaces account access; it does not add a backup.
              Keep this browser session until the replacement is enrolled.
              Afterwards, that passkey can resume this attempt before it
              expires. There is no administrator bypass.
            </p>
            <label>
              Public username
              <input
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              Unused recovery code
              <input
                required
                autoComplete="off"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button disabled={busy}>Start recovery</button>
          </form>
        </>
      )}
      {mode === "account" && account && (
        <>
          <h2>{account.username}</h2>
          {account.attempt && (
            <div className="notice">
              <h3>Recovery pending — restricted access</h3>
              <p>
                Earliest completion:{" "}
                <time dateTime={account.attempt.holdUntil}>
                  {displayTime(account.attempt.holdUntil)}
                </time>
                .
              </p>
              <p>
                Attempt expires:{" "}
                <time dateTime={account.attempt.expiresAt}>
                  {displayTime(account.attempt.expiresAt)}
                </time>
                .
              </p>
              <p>
                Ordinary account actions are disabled. Resuming does not reset
                these times.
              </p>
            </div>
          )}
          {account.kind === "MEMBER" && (
            <>
              <h2>Your passkeys</h2>
              <ul>
                {account.keys.map((key) => (
                  <li key={key.id}>
                    {key.label}{" "}
                    <button
                      disabled={busy || account.keys.length <= 1}
                      onClick={() =>
                        run(async () => {
                          await api("remove", { id: key.id });
                          setAccount(await api("account"));
                        })
                      }
                      aria-label={`Remove ${key.label}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <p>
                You must retain at least one passkey. Adding or removing a key
                revokes your other sessions.
              </p>
              <h2>Add a backup passkey</h2>
              <p>
                Use a different security key or independently managed credential
                store. Another passkey in the same device or synced account may
                be refused or replace the existing one; it is not necessarily an
                independent backup. Do not start recovery just to add a backup.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => ceremony("add"));
                }}
              >
                {labelField}
                <button disabled={busy}>Add passkey</button>
              </form>
              <h2>Offline recovery codes</h2>
              <p>
                {account.codeCount} unused codes. Generating a new set
                invalidates every previous code. Save them offline; they are
                shown only once. Anyone holding a code can begin recovery.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const result = await api("codes");
                    setCodes(result.codes);
                    setAccount(await api("account"));
                  })
                }
              >
                Generate new recovery codes
              </button>
              {codes.length > 0 && (
                <div className="panel">
                  <ul>
                    {codes.map((c) => (
                      <li key={c}>
                        <code>{c}</code>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => setCodes([])}>
                    I saved these codes offline
                  </button>
                </div>
              )}
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("logout", { all: true });
                    window.location.assign("/login");
                  })
                }
              >
                Revoke all sessions
              </button>
            </>
          )}
          {account.kind === "RECOVERY" && (
            <>
              <h2>Replace account access</h2>
              <p>
                Creating a replacement in the same credential manager can
                overwrite the original passkey, including on synced devices.
                That original may then be unavailable to contest recovery. A
                replacement can only resume this attempt until completion after
                the hold; it cannot cancel recovery.
              </p>
              {!account.replacementEnrolled && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(() => ceremony("recover-enroll"));
                  }}
                >
                  {labelField}
                  <button disabled={busy}>Enroll replacement passkey</button>
                </form>
              )}
              {account.replacementEnrolled && (
                <p>
                  Replacement enrolled. Signing out does not cancel recovery.
                  You can use{" "}
                  <Link href="/recover">Resume with replacement passkey</Link>{" "}
                  before this attempt expires.
                </p>
              )}
              <p>
                After the hold, select the replacement passkey to finish. Old
                passkeys and all remaining codes will be revoked.
              </p>
              <button
                disabled={busy}
                onClick={() => run(() => ceremony("recover-finish"))}
              >
                Finish recovery with replacement
              </button>
              <p>To contest this attempt, sign in with an original passkey.</p>
            </>
          )}
          {account.kind === "CONTEST" && (
            <>
              <p>
                Your original passkey has proven control. Cancelling invalidates
                recovery codes, pending replacements, and all sessions. Sign in
                again afterwards.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("cancel");
                    window.location.assign("/login");
                  })
                }
              >
                Cancel unauthorized recovery
              </button>
            </>
          )}
          <p>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api("logout");
                  window.location.assign("/login");
                })
              }
            >
              Sign out
            </button>
          </p>
        </>
      )}
    </section>
  );
}
