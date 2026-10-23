# Database schema proposal — not a migration

Keep existing evidence tables and `User.id` references intact. The current `User.role` is a local-development artifact, not an acceptable production authorization source. Do not apply this proposal to `prisma/schema.prisma` before approval. Types below are conceptual PostgreSQL models; constraints, indexes, migrations, and Prisma mappings must be implemented and reviewed later.

## Core account/auth store

| Model                | Proposed fields and constraints                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User (extend)        | Existing immutable ID; lifecycle enum ACTIVE/RECOVERY_PENDING/SUSPENDED/DELETION_PENDING/DELETED; authVersion bigint; createdAt. Do not infer role from lifecycle.                                           |
| PublicProfile        | userId unique FK; handleCanonical unique; displayText; changeVersion. Public projection only. Handle reservation/tombstone table prevents reuse.                                                             |
| PasskeyCredential    | ID; userId FK; credentialId unique bytes; publicKey bytes; algorithm; counter; backup eligibility/state flags; createdAt/lastUsedAt/revokedAt. No attestation certificate or device fingerprint persistence. |
| AuthChallenge        | ID; challengeHash unique; ceremony type; optional userId; pendingRegistrationId or recoveryAttemptId; browserBindingHash; expiresAt; consumedAt. Conditional atomic consume.                                 |
| PendingRegistration  | random ID/userHandle; handle reservation; expiresAt; no credential until proof. Expiring unique reservation prevents signup races.                                                                           |
| Session              | ID; userId FK; tokenHash unique; authVersion; authMethod PASSKEY/RECOVERY; authenticatedAt/lastSeenAt/expiresAt/absoluteExpiresAt/revokedAt; optional parent recovery ID. No raw token/IP/UA.                |
| RecoveryCode         | ID; userId FK; keyed codeHash unique; keyVersion; generation; consumedAt/revokedAt. Never plaintext.                                                                                                         |
| RecoveryAttempt      | ID; userId FK; state enum; codeId unique; boundSessionId; pendingCredentialId; holdUntil/expiresAt; cancelledAt/completedAt. At most one active attempt per account.                                         |
| AccountRestriction   | ID; userId FK; scope; safe publicReason; private category; issuedBy; startsAt/expiresAt/revokedAt; appealId; version. No verification receipt.                                                               |
| AccountAppeal        | ID; accountId nullable until ownership is established; caseTokenHash; category; state; safe response code; independent assignee; dueAt/closedAt. No attachment or identity free-text field.                  |
| TrainingCompletion   | userId; curriculum/version; assessorId; completedAt/expiresAt. Unique current version per role track.                                                                                                        |
| PrivilegeApplication | ID; userId; scope; state; trainingId; eligibilityLeaseId (opaque); rationaleCode; version.                                                                                                                   |
| PrivilegeApproval    | applicationId; approverId; decision; rationaleCode; createdAt. Unique(applicationId, approverId); applicant cannot approve.                                                                                  |
| PrivilegeGrant       | ID; userId; scope; applicationId unique; validFrom/expiresAt/revokedAt/suspendedAt; version. Require two valid approvals and active training in grant transaction.                                           |
| AccountAuditEvent    | ID; actorId or service principal; targetId; action enum; safe category; timestamp; caseId. Separate from existing claim-linked AuditEvent; no generic JSON payload.                                          |
| ConductEvent         | ID; userId; action category; restriction/appeal reference; expiry; explainable reason. No numeric truth or political-interest score.                                                                         |
| DataRequest          | ID; userId; EXPORT/DELETE; state; dueAt; artifactHandle/expiresAt; holdReference. Restricted worker access.                                                                                                  |

Use FKs and unique/check constraints where possible. Multi-row two-person approval, live revocation, code consumption, and session issuance need transactions and row locks; do not pretend enum fields enforce the protocol. Partial unique indexes enforce one active recovery and overlapping-grant rules where Prisma cannot express them. Mutation idempotency keys are scoped to actor/action and expire after 24 hours. Grant issuance, audit, and application state transition commit atomically. Session token replacement is atomic; a retired token is never accepted in a grace window.

## Isolated broker store

| Model                   | Proposed fields and constraints                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VerificationLink        | random brokerAccountRef; encrypted core account mapping under a broker-only key; deletion state. Core has no direct FK/query join into this database.                                                        |
| VerificationTransaction | opaque ID; brokerAccountRef; issuer alias; nonceHash/stateHash; requested policy; expiresAt; consumedAt.                                                                                                     |
| VerificationReceipt     | ID; brokerAccountRef; issuer alias; providerPairwiseSubjectHmac + keyVersion; coarse assurance/status enums; issuedAt/expiresAt/revokedAt; policyVersion; assertionDigest. No raw signed assertion retained. |
| BrokerEvent             | issuer + eventId unique digest; processedAt/expiresAt for replay defense. No callback payload.                                                                                                               |
| VerificationAppeal      | ID; brokerAccountRef; receiptId; structured issue code; reviewer; decision code; openedAt/closedAt. No uploaded documents, names, or unrestricted notes.                                                     |
| EligibilityLease        | opaque ID; appointment-purpose reference; eligible boolean; policyVersion; expiresAt (maximum five minutes). Not returned to moderators or public profiles.                                                  |

Only one active receipt for a given issuer/subject token under the selected duplicate policy; contested duplicates go to a private appeal, never silent account merging or public exposure. Key rotation uses a bounded dual-key lookup period; old tokens are rekeyed only when the provider reasserts the subject, otherwise expire/reverify. Do not retain unhashed provider subjects to simplify rotation. Broker/core lifecycle events use an idempotent outbox with acknowledgements and retry; deletion is not complete until both stores acknowledge it.

Explicitly absent: government IDs, legal-name account fields, document numbers/images, birth dates, addresses, selfies, biometric verification records, raw reports, provider-wide identifiers, or an evidence-truth score. Public citations may name people as part of evidence; they are not a legal-name verification registry. Never repurpose public content or support tickets to collect identity proof.

## Migration compatibility

Backfill PublicProfile from existing display names only after collision review; do not assume existing names are unique. Preserve `User.id`, evidence authorship, revisions, and audit links. Mark seeded local identities as development-only and never auto-enroll them as production accounts. Deploy production auth behind disabled flags, then grant-based policy adapters, with a temporary explicit mapping for development tests only. No production fallback to `User.role` or the shared secret. Remove the legacy role authorization path only after compatibility and rollback tests. Rollback closes writes, revokes new sessions, and preserves data; never re-enable development authentication to recover production access.
