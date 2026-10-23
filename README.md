# Ground Zero

An open-source, nonpartisan evidence commons. Inspect claims and sources, distinguish evidence from interpretation, and keep corrections visible. Ground Zero is not an infallible arbiter of truth.

**Local prototype only. Do not deploy publicly.** Public registration is disabled by default, and development authentication never works in production.

## Local setup

Requires Node.js 22.12+ (Node 22 LTS recommended), npm, and Docker with Compose running.

```sh
npm ci
cp .env.example .env
```

Edit `.env`: replace the example database password in both `POSTGRES_PASSWORD` and `DATABASE_URL` with the same unique local password (URL-encode it in the connection string). Never commit `.env`.

```sh
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run dev
```

Open [the local application](http://127.0.0.1:3000). The app and database bind to loopback. The library starts empty: no fabricated factual claims or evidence are seeded. If the database is unavailable, the home page explains setup; it does not silently substitute sample data.

### Enable local contributions

Generate a secret with `openssl rand -hex 32`, put it in `DEV_AUTH_SECRET` in `.env`, and set `DEV_AUTH_ENABLED=true`. Restart `npm run dev`, visit **Local access**, enter that secret, and select the Contributor test role. The secret is entered in the local sign-in form and sent to the server; it is not persisted in browser storage; a signed, HTTP-only, SameSite=Strict cookie expires after eight hours. Rotating the secret invalidates sessions. Sign out via Local access.

Submit a statement, context, type, and at least one source URL with attribution and explanation. The form accepts a second source; more sources can be attached on the detail page. HTTP(S) URLs are linked without scraping or fetching their content. Links may lead to untrusted external sites.

To exercise human review, sign out and sign in using the Reviewer test role. Publish a status with a public rationale. Contributor accounts cannot change review status. Corrections are limited to the author or a reviewer, preserve earlier snapshots, and reset review to Unreviewed. Attaching new evidence also resets review so previous judgments do not implicitly cover new material.

This shared-secret role selector is **only a developer test tool**. Do not expose the development server, proxy it publicly, or use real personal information. `npm run build && npm start` serves a production build with development authentication disabled, even if the development flag remains set.

### Database lifecycle

`npm run db:migrate` applies committed migrations; `npm run db:dev -- --name descriptive_name` creates a migration during development. Commit both schema and SQL migration. `docker compose down` stops services while preserving the database volume. Back up data before removing volumes; there is no deletion workflow in this milestone.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Integration and browser tests require a **separate, disposable PostgreSQL database**. Create one, set `DATABASE_URL` and `TEST_DATABASE_URL` to its connection string in your shell, then run:

```sh
npm run db:migrate
npm run test:integration
npx playwright install chromium
npm run build
npm run test:production
npm run test:e2e
```

If the browser download is unavailable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed Chromium executable for local verification. CI uses Playwright’s pinned browser.

Integration tests clean up only their own fixtures. Browser tests leave clearly labeled fictional fixtures in the disposable database. The production browser test runs on port 3101 and confirms that an enabled development flag and correctly signed reviewer cookie cannot unlock contributions. Run it after a production build and before the development suite, which overwrites `.next`. The development browser suite starts its own loopback development server on port 3100 and checks submission, escaped untrusted text, correction history, reviewer access, and a mobile viewport. CI provisions PostgreSQL 17 and runs migration, lint, type checking, unit, integration, production build, and browser tests.

## Functional in milestone 1

- Responsive claim library (latest 50, chronological; no popularity ranking), claim detail, attributed evidence links, and public revision snapshots.
- Validated claim creation, evidence attachment, author/reviewer corrections, reviewer-only status changes, and atomic audit/history writes through server actions.
- Provisional states: Unreviewed, Under Review, Supported, Disputed, Refuted, Insufficient Evidence.
- Separate factual statements, interpretations, opinions, and unknowns.
- PostgreSQL schema and migration for users, claims, sources, evidence, revisions, discussions/comments, moderation actions, and private audit events.
- Fail-closed development authentication; no anonymous writes; passkey members can contribute while production development-authentication fallback stays disabled.

## Still planned / launch blockers

Public rollout, stronger anti-abuse controls, moderation and appeals interfaces, privacy/redaction and retention procedures, accessible review methodology, reviewer assignment and conflicts of interest, discussion UI, search/pagination, backups/restore drills, production CSP, and independent security/accessibility reviews. Discussion and moderation models are scaffolding only; no claim is made that their workflows exist. No public API, AI adjudication, scraping, profiling, or recommendation algorithm is implemented.

See [architecture and tradeoffs](docs/ARCHITECTURE.md), [security policy](SECURITY.md), [charter](CHARTER.md), [contribution guide](CONTRIBUTING.md), and [community rules](CODE_OF_CONDUCT.md).

## License

GNU AGPL-3.0-or-later. The complete, unmodified version 3 license text is in [LICENSE](LICENSE). Project code may be used under version 3 or, at your option, any later version. Network deployments of modified versions must comply with the license's corresponding-source obligations.

The [Milestone 1 review](docs/MILESTONE_1_REVIEW.md) records fixes, verification, and deferred launch protections.

## Proposed identity design

[Milestone 2A: gradual identity verification](docs/identity/DESIGN.md) is a design-only proposal. Public registration remains disabled; implementation requires separate approval.

## Passkey authentication (Milestone 2B)

After `npm ci`, `npm run db:generate`, and `npm run db:migrate`, set `AUTH_ORIGIN=http://localhost:3000`, `AUTH_RP_ID=localhost`, and a separate `RECOVERY_CODE_KEY` generated with `openssl rand -hex 32` in `.env`. Use **http://localhost:3000** for passkeys; Secure cookies are retained on localhost by supported browsers. For any non-local origin use HTTPS; the configured RP ID must equal its hostname. Never derive allowed origins from request headers.

`AUTH_REGISTRATION_ENABLED` defaults to false and is checked at both registration steps. Enable it only for isolated synthetic-account testing. Visit `/register`, then `/account` to add backup passkeys and generate eight offline recovery codes. No password, email, phone, or identity document is needed. New accounts are contributors, never reviewers/moderators; the legacy role field cannot promote passkey sessions.

`/login` provides passkey reauthentication. Security changes require authentication within 15 minutes. Member sessions expire after 24 hours idle or seven days absolute; logout and revoke-all are server-side. Adding/removing credentials revokes other sessions. Save recovery codes offline; regenerating codes invalidates the previous set. Store the recovery HMAC key securely; rotating it invalidates existing codes and requires members with passkey access to generate new ones.

`/recover` consumes one code, revokes sessions, and opens a recovery-only browser session. Enroll a replacement passkey, wait `RECOVERY_DELAY_HOURS` (24 by default; 24–48 allowed), then prove it to finish. Attempts expire after 72 hours. After enrollment, signing in with that pending passkey (or **Resume with replacement passkey**) restores only restricted access to the same active attempt, without changing its hold or expiry. This works after logout or cookie loss, including attempts created before this fix. An original passkey can still sign in only to contest; cancellation revokes pending keys, codes, and sessions. Completion revokes old keys/codes. Expired or cancelled replacements cannot resume recovery. Without an enrolled replacement, losing the recovery browser requires an original passkey or another unused code. There is no staff bypass or off-device notification.

Adding a backup passkey in `/account` differs from replacing access through recovery. Use an independent authenticator or credential store for a backup. [Apple documents](https://developer.apple.com/documentation/authenticationservices/supporting-passkeys) that registering the same user ID overwrites the existing passkey on users’ devices. Ground Zero uses the same account user handle during replacement, consistent with the reported macOS behavior; the particular device state has not been independently inspected. Enrollment can therefore remove the original means of contesting. A second device in the same synced credential store is not necessarily an independent backup.

Run `npm run auth:prune` hourly in a local operational setup to remove expired challenge/rate/session records and expired recovery attempts/pending keys. Validity is enforced even if pruning has not run. The command reads `.env`; no scheduler is installed automatically.

Tests on a disposable migrated database:

```sh
npm test
npm run test:integration
npm run build
npm run test:production
npm run test:e2e
npm run test:passkeys
```

The last suite uses Chromium's virtual WebAuthn authenticator, synthetic accounts, and real verification. Tests advance the recovery hold directly in the disposable database; there is no runtime delay bypass. Browser suites must run sequentially because Next.js shares `.next`. Public registration, provider integration, deployment, and L3 privileges remain outside this milestone. See SECURITY.md for remaining risks.
