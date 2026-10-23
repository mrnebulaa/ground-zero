# Privacy and data-retention proposal

All periods below are proposed operational maxima awaiting privacy/security and jurisdiction-specific review, not legal advice or a claim of compliance. The privacy lead owns the schedule; engineering owns enforced TTL/purge jobs; a separate reviewer approves extensions. Publish the final notice before collection. Optional verification requires informed opt-in and an explicit way to withdraw; do not make it a condition of ordinary participation.

## Data minimization and access

No Ground Zero identity UI, API, database, object store, logs, queue, export, or support workflow may accept/store ID scans, legal names as identity attributes, or biometric verification records. No document attachments or free-text verification evidence. Use enum-based verification/appeal reasons; substantive document disputes stay with the provider through a separate link. Disable request-body logging, APM payload capture, and callback query-string recording at ingress before using any provider. Test rejection and accidental-intake incident procedures using synthetic canaries only.

A provider may independently process sensitive data only after a future contract and privacy review establishes permitted purposes, non-biometric alternatives, regions, subprocessors, deletion, breach notice, and no advertising/training reuse. Ground Zero must disclose that boundary and cannot promise data never exists at the provider. An opaque provider token is still personal data. Do not call the system anonymous identity verification; it is private pseudonymous attestation.

## Retention schedule

| Data                                          | Maximum proposed retention                                                    | Access / deletion behavior                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Auth challenges and handle reservations       | Five and ten minutes respectively; purge within one hour                      | Auth service only; consumed records never reusable                                               |
| Live session hashes                           | Idle/absolute expiry from architecture; purge expired/revoked within 24 hours | Owner sees coarse session list, not hashes                                                       |
| Credentials and recovery code hashes          | Account lifetime or revocation; purge revoked within 24 hours                 | Auth service; no secret export                                                                   |
| Pending recovery                              | 72 hours; purge unactivated keys within 24 hours of expiry                    | Restricted auth workflow; minimal security event survives separately                             |
| Network-prefix rate buckets                   | Rotating key daily; buckets at most 24 hours                                  | Edge abuse service; no raw IP persistence, no cross-day tracking                                 |
| Raw IP/request bodies                         | Transient processing only; no durable application/access-log storage          | Configure ingress/CDN/APM; contract review for vendor infrastructure logs                        |
| Ordinary auth/security audit categories       | 30 days                                                                       | Security staff with case-bound access; no tokens, IPs, raw UA, payloads                          |
| Receipt/subject token                         | Until expiry, withdrawal, or deletion plus seven days to reconcile deletion   | Broker only; default attestation validity at most 12 months pending policy review                |
| Provider event replay digests                 | Seven days, with accepted assertion lifetime at most five minutes             | Broker; old assertions rejected independently of digest deletion                                 |
| Closed verification appeals                   | 90 days after closure                                                         | Privacy stewards; structured reasons only                                                        |
| Restriction/privilege/appeal decision records | 12 months after closure/expiry                                                | Scoped decision/audit staff; sanitized public rationale separate                                 |
| Confirmed serious-abuse subject tombstone     | Optional, at most 90 days, two-person approval and 30-day review              | Broker HMAC only; no automatic ban; notify affected account and allow appeal                     |
| Export artifacts                              | 24 hours; one-time download                                                   | Encrypted, fresh authorization, no public links                                                  |
| Encrypted backups                             | Rolling 30 days                                                               | Restore pipeline reapplies deletion ledger before serving traffic                                |
| Deletion ledger                               | 35 days after live purge, no content                                          | Privacy worker; target IDs only, then purge                                                      |
| Public evidence/history and handle tombstones | No automatic expiry pending redaction/accountability policy                   | Reading preserved; account deletion detaches profile and removes identifying text where required |

No indefinite silent legal hold. Any exceptional hold needs a documented purpose, minimal fields, restricted access, expiry and 30-day review; give notice unless prohibited. The privacy reviewer must resolve conflicts between a valid deletion request, public corrections, and accountability before launch. No automatic promise to delete public copies already downloaded by others.

## Deletion and export

Fresh passkey authentication (or completed recovery followed by fresh passkey proof) authorizes these actions. Restricted members retain these rights subject to narrowly reviewed holds, not moderator convenience. Queue requests with idempotent IDs; target completion within 30 days, not an asserted statutory deadline. On deletion, immediately revoke sessions and grants and close contribution access. Purge credentials, recovery state, private verification link/receipts, and optional contact data if ever introduced. Request provider deletion independently and track acknowledgement; disclose provider delays or applicable retention instead of marking external erasure complete prematurely.

Preserve existing claim/revision ownership with a non-login tombstone User rather than breaking FKs. Remove public profile/display attribution links and apply the separately approved redaction process to personal material, including old revisions. A pseudonym/history can still identify someone; tombstoning is not guaranteed anonymization. Reserve old handles without retaining private verification status. Review public attribution retention before production.

Export only the requester's public contributions and own private account/decision summary via separate authorization paths. Include own coarse verification result and dates, not provider subject tokens, hashes, keys, raw assertions, other users' records, staff private case notes, or third-party personal data. Owners receive reasoned decisions without exposing other people or abuse-detection secrets. Export isolation tests must include redacted appeals and mixed-party discussions.

## Challenges and appeals

Show private verification denials/expiry with a structured reason, provider dispute link, and Ground Zero steward-review route. Do not tell the member which other account matches a duplicate token. An independent steward can correct linkage/process errors or request a fresh assertion, never change provider evidence invisibly. Identity disputes never settle claim truth.

Account restrictions provide a safe rule reference, duration, scope, and appeal instructions. A different authorized human reviews the appeal, records outcome and rationale, and notifies the member through the private case channel. Target acknowledgement within seven days and a decision/update within 30 days; publish staffing limits before launch. An inaccessible account can open a restricted case without being granted login; release account-specific details only after ownership proof. Appeal success removes the relevant restriction but does not by itself authenticate the requester or restore privileged grants.
