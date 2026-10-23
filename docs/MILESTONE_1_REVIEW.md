# Milestone 1 review

## Scope and findings

Reviewed server actions, server-resolved identities, development sessions, input validation, Prisma transactions and constraints, public read projections, UI rendering, charter, license declarations, and project policies. This is an implementation review, not an independent penetration test or accessibility certification.

No anonymous mutation or contributor review-status bypass was found in the exposed action paths. Every mutation resolves the actor server-side. Session payloads contain identity and expiry, not a role; deleted users fail authentication and role changes are read from the database. The internal claim service accepts a trusted actor object and must never be exposed directly to request-provided roles. Production rejects development sessions before querying users, even with the flag and matching secret set. A production-build browser regression verifies the same with a correctly signed reviewer cookie.

Fixed within this milestone:

- Bound source URLs after normalization: Unicode percent encoding can otherwise expand a short input beyond the promised limit and exceed PostgreSQL's unique-index entry capacity.
- Reject null characters before persistence; PostgreSQL text cannot store them.
- Use updating source upserts and consistent URL lock ordering to avoid racing source creation and opposite-order shared-source locks.
- Add an audit-to-claim foreign key in a separate migration, preserving the original migration. Existing orphan audit rows intentionally cause migration failure and require investigation, not silent deletion.
- Add concurrent evidence/duplicate/shared-source regressions, audit integrity, valid-session production rejection, malformed sessions, role demotion, and deleted-user coverage.
- Correct the README's description of the secret: it is entered in the browser form and transmitted locally, not persisted in browser storage.

The charter, root and legacy charter link, README, license metadata, contribution rules, and security/community policies consistently specify AGPL-3.0-or-later, nonpartisan governance, provisional evidence assessments, human oversight, and no public launch. Operational moderation and appeals remain aspirations with explicit launch gates, not implemented features.

## Verification

Both migrations applied to a new, empty PostgreSQL cluster. Unit, database, development-browser, production-browser, lint, type, formatting, and production-build results are recorded in docs/VERIFICATION.md and the pull request. CI provisions a fresh PostgreSQL 17 database and Node 22; local tests use PostgreSQL 18.4 and Node 26.5. The original PR-head CI run passed before review changes; the updated head must also pass before handoff.

## Deferred protections and limits

| Area                      | Remaining work / limitation                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and abuse        | Shared secret grants both local test roles, lacks per-user identity, MFA, recovery, login rate limiting, individual revocation, and production role provisioning. Sign-out removes the browser cookie but does not revoke a copied cookie; rotate the secret to invalidate all sessions. Never expose the development server or proxy it publicly.    |
| Deployment security       | Independent authorization/CSRF and penetration review, production CSP/TLS/secure cookies, dependency maintenance, least-privilege database roles, monitoring and incident response are not complete. Next.js same-origin action protection is relied upon; adversarial browser/proxy testing is deferred.                                             |
| Dependencies              | One unresolved high-severity braces advisory propagates to five development-tool entries. Production audit was clean at implementation; this is not a permanent security guarantee. Review patched overrides as upstream releases change.                                                                                                             |
| Privacy                   | Claims, attributions, URLs, usernames, and old revisions are publicly readable. No redaction, deletion/export, retention, consent, or private-evidence workflow exists. URLs can contain query tokens, tracking, or personal information; those cannot be reliably detected. Do not submit sensitive material.                                        |
| Links and evidence        | HTTP(S) links can be deceptive, point at local/private addresses, or change over time. They are never fetched server-side, so this does not create a server-side URL-fetch path. No archival, malware screening, provenance verification, source-date enforcement, or credibility adjudication exists.                                                |
| Moderation and governance | No reports, appeals, moderation UI, private reporting operations, reviewer assignment, conflict enforcement, transparency reporting, or independent oversight. Models alone provide none of those operational protections. A contributor can repeatedly reopen review by adding sources; abuse prevention is deferred.                                |
| Integrity and operations  | Database administrators can alter history; no tamper evidence or database append-only permissions. No backup/restore drills, automatic deadlock retries, mutation idempotency keys, or external URL canonical equivalence. Duplicate retries can create separate claims. Read history/evidence is unbounded and the library shows only 50 records.    |
| Accessibility             | Labels, focus outlines, skip link, textual statuses, native disclosure controls, error alerts, and mobile reflow exist. No full WCAG audit, screen-reader matrix, zoom/contrast testing, automated accessibility scan, or field-specific error association/focus management has been completed. Keyboard-only end-to-end verification remains needed. |
| Review semantics          | Reviewers can label any claim type and can review their own claims; substantive methodology, opinion-versus-fact adjudication, reviewer independence, and conflict policies are not enforced by software. Labels never establish infallible truth.                                                                                                    |

No merger, public deployment, or Milestone 2 implementation is authorized by this review. Passing tests means ready for human review of a local prototype, not ready for public participation.
