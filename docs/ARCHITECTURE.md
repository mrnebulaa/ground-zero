# Architecture decisions — milestone 1

## Modular monolith

Next.js App Router serves React pages and server actions. `lib/validation.ts` defines boundary schemas; `lib/claims.ts` owns authorization and transactional mutations; `lib/auth.ts` resolves signed local sessions into database users; `lib/db.ts` shares Prisma connections in development. PostgreSQL stores relational records. This keeps deployment and maintenance simple without preventing a later API or worker.

Server actions are the only mutation transport. Their actor argument is internal and must always come from trusted server-side authentication. Future callers must not deserialize actors or roles from requests. The service checks permissions before validating content; public page reads never return private moderation or audit records.

## Evidence and corrections

A Source identifies a normalized HTTP(S) URL. An Evidence record joins it to a claim with contributor attribution, explanation, relation, author, and timestamp. Attribution belongs to the attachment: contributors cannot overwrite shared metadata for all claims. One URL can appear once per claim; a reused URL is not independent corroboration. URLs retain query strings/fragments to preserve citation specificity. We do not download or archive external material; link rot remains a limitation.

Each claim mutation writes a full public claim snapshot and a private audit event in one database transaction. Evidence is append-only through the application, and its addition is named in revision history. Corrections and evidence additions reset status to Unreviewed. Status changes require a reviewer and public rationale. An incrementing version plus conditional update prevents concurrent reviewers or editors from silently overwriting each other. Source uniqueness constraints and transaction rollback prevent partial attachments.

The current interface shows up to 50 recent claims, ordered by creation time and ID. It has no personalization, voting, or popularity ranking. Detail pages currently read the entire evidence/history record; add bounded pagination before scale. There is no seed command because test fixtures must not masquerade as real evidence.

## Local authentication

Production authentication is deliberately absent. An opt-in shared secret creates a signed eight-hour local session for a fixed contributor or reviewer identity. This enables end-to-end permission testing without pretending to provide secure public accounts. The production build refuses these sessions. No automatic administrator or anonymous write path exists. Roles are loaded from PostgreSQL on each mutation.

## Moderation boundary

Discussion, comment, moderation, and audit models establish relationships without exposing incomplete social workflows. Moderation records separate public reasons and appeal instructions from private notes. A future public projection must explicitly select safe fields. Appeals and privacy redaction remain launch blockers; the prototype has no moderation UI or guarantee that those protections are operational.

## Alternatives and follow-up

A separate API, search engine, queue, recommendation system, or AI adjudicator would add complexity without serving the local milestone. Shared URL metadata was avoided because an attachment should preserve what its contributor actually cited. Database-level append-only privileges and cryptographic audit chains are deferred; database administrators can currently modify history. Document production retention, deletion/redaction, migrations, and least-privilege database roles before public launch.
