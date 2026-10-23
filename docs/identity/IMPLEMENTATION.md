# Implementation and acceptance criteria

Milestone 2B implements the internal L1 passkey/session/recovery slice behind default-off registration; see [setup and tests](../../README.md#passkey-authentication-milestone-2b). L3 grants, providers, operational appeals, full lifecycle/deletion, and public rollout remain deferred. Existing local fixture accounts are not automatically enrolled. User.username is the persistent public profile for this slice; no separate profile table or rename feature is added.

Each phase requires a separate reviewed change and the acceptance evidence below; [DESIGN.md](DESIGN.md) defines policy and constraints.

| Phase                        | Deliverable after approval                                                                                                                  | Exit criteria                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A — design approval          | Resolve recovery loss tradeoff, role-suitability alternatives, steward/approver governance, RP domains, privacy schedule, provider criteria | Maintainer, security, privacy, accessibility, and community-governance sign-off; unresolved owners recorded                                |
| B — internal authentication  | Passkeys, canonical pseudonyms, hashed revocable sessions, recovery codes; synthetic/internal accounts only                                 | Protocol and recovery/concurrency tests, accessible hardware-key flow, no public signup, no production dev-auth fallback                   |
| C — policy integration       | Account-state/permission service, scoped grants, dual approvals, restrictions/appeals, private audit and notices                            | Negative authorization matrix, review conflicts, training expiry, revocation ordering, same rules for staff                                |
| D — lifecycle readiness      | Deletion/export/purge/restore jobs, redaction procedure, operator segregation, monitored incident and appeal processes                      | Prove erased data cannot reappear on restore; launch privacy notice and staffing approved                                                  |
| E — invitation L1 pilot      | Limited registration only after a separate explicit launch approval                                                                         | Rate/abuse metrics without profiling, manual false-positive review, accessible recovery, rollback drill; evidence regressions remain green |
| F — optional attestation     | Isolated broker with synthetic signed fixtures first; select provider only through separate approval                                        | Contract/privacy review, strict minimal assertion, owner-only state, revocation/withdrawal drills; no document intake                      |
| G — approved L3 appointments | Trained reviewers/moderators with verified suitability, two-person approval, expiring grants                                                | No self-approval, no ordinary moderator receipt access, appeals ready, public scope notices, independent oversight                         |

L3 framework can be tested before a real L2 provider using the approved alternative suitability process; no pilot member automatically becomes staff. C–G remain future implementation proposals and require separate approval.

## Migration and rollout

Backfill PublicProfile from existing display names only after collision review; do not assume existing names are unique. Mark seeded local identities as development-only and never auto-enroll them as production accounts. Deploy production auth behind disabled flags, then grant-based policy adapters, with a temporary explicit mapping for development tests only. No production fallback to `User.role` or the shared secret. Remove the legacy role authorization path only after compatibility and rollback tests. Rollback closes writes, revokes new sessions, and preserves data; never re-enable development authentication to recover production access.

Preserve anonymous GETs without signup walls, cookies, or identity-dependent content ranking. Existing sources, revision snapshots, status semantics, and transactional evidence service remain authoritative. Extend authentication/policy at the service boundary; never add private verification attributes to claim-service inputs. New credential/store migrations must be additive first, preserve IDs/FKs, and have tested rollback.

Keep separate flags for registration, provider requests, and privileged grant issuance, all default-off. Disabling registration does not strand existing members; disabling the provider preserves L1 and lets eligibility leases expire safely. Incident rollback closes affected writes, revokes sessions/grants as appropriate, preserves anonymous reads and history, and never falls back to development authentication.

## Open decisions requiring named owners

- Security lead: RP ID/origins, cryptographic library review, recovery delay usability, token/key rotation, step-up defaults, two-person bootstrap.
- Privacy lead: applicable jurisdictions, provider regions/subprocessors, retention/holds, public pseudonym tombstones versus erasure, narrow ban-token necessity.
- Community governance: suitability criteria, reference route fairness, appeals staffing, training content, conflict policy, 90-day term renewal.
- Accessibility lead: browser/device matrix, no-biometric alternatives, assisted setup without credential custody, recovery code accessibility.
- Maintainers: operational staffing, initial invitation limits and measured quota thresholds, independent security review budget.

No guarantee of perfect uniqueness, ban prevention, legal compliance, or account recovery is asserted. If privacy/accessibility requirements cannot be met by a provider, L2 remains unavailable rather than weakening L1 rights.

## Security testing acceptance criteria

Test only synthetic identities, opaque fixture receipts, and generated canaries—never real identity documents. All tests below are future acceptance criteria, not claims of implemented coverage.

| Area                  | Required tests / expected result                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous reading     | No login/cookie requirement for public claims/evidence/history; same data/order regardless of private level; registration/provider outages preserve reading                                                                                                |
| WebAuthn              | Wrong origin/RP/audience/userHandle/algorithm, missing UV, forged signatures, expired/wrong-purpose challenge, replay and double consumption rejected; supported passkey/PIN/security-key and sync-counter cases accepted appropriately                    |
| Registration          | Concurrent canonical-handle/credential collisions cannot create duplicate owners; reservation expiry releases unused handles; failed ceremony creates no active account/session; reserved staff handles rejected                                           |
| Sessions              | Fixation, stolen retired tokens, expired/idle tokens, CSRF, cross-origin POST, account ID tampering, revocation and authVersion mismatch denied; session expiry does not depend on cleanup job                                                             |
| Recovery              | Code reuse, cross-account binding, simultaneous attempts, premature hold completion, expired browser binding, forged cancellation, and token replay fail; completed recovery atomically retires old credentials/sessions; no email/provider/staff shortcut |
| Account lifecycle     | Deleted/suspended/recovery-pending users cannot write; restrictions still permit safe appeals/exports as specified; grant cannot override restriction                                                                                                      |
| Matrix                | Table-driven allow/deny for every action, actor type, ownership, restriction, grant scope/expiry and step-up age; reviewer cannot moderate without another grant; ordinary moderator cannot enumerate receipts or access broker credentials                |
| Privileges            | Two identical approvers, applicant approval, stale approval, missing training, own-claim review, expired eligibility, self-granting, and recovery-preserved roles rejected; revocation racing an action has transaction-defined order and audit            |
| Broker protocol       | Bad issuer/key/signature, stale assertion, audience mismatch, callback swap, duplicate events, extra identity fields, timeout, provider downgrade/revocation, rotation and invalid state rejected without raw logging; outage never disables L1            |
| Privacy disclosure    | Inspect API/RSC/HTML/search/cache/log/metrics/exports/errors for receipt/status leakage; canaries for document/name/biometric fields rejected before persistence across edge, queue, APM and backup paths                                                  |
| Data lifecycle        | TTL expiry, purge delay alarms, deletion propagation failures/retry, provider acknowledgement, hold expiry, backup restoration ledger, export authorization/expiry and cross-account IDOR; never expose internal subject tokens                            |
| Abuse fairness        | Shared NAT/VPN, shared devices, screen-reader users, newcomers and provider failures are not auto-banned; accessible challenge alternative; quota races bounded; appeal success reverses only intended restrictions                                        |
| Evidence independence | Same claim/source input under L1/L2/L3 cannot change truth status without authorized review action and rationale; no verification metadata in review/ranking dependencies; old attribution/history/FKs preserved                                           |
| Accessibility         | Keyboard-only and screen-reader registration/recovery/appeals, errors and focus, zoom/contrast, device/PIN fallback, long translated instructions, accessible offline code presentation; no biometric-only workflow                                        |
| Operations            | Database/broker/queue outage, clock skew, key compromise, revoked staff, poison callback and restore drills; no fail-open writes; no sensitive test artifacts in CI                                                                                        |

Use unit protocol fixtures, real PostgreSQL transaction tests, browser tests on approved platforms, API/role projection fuzzing, dependency/secret scans, and independent penetration/privacy/accessibility reviews. Do not rely only on happy-path UI tests. Verify non-disclosure with a canary in each forbidden field and inspect all storage/logging sinks, including error telemetry.

Before each future launch gate, record exact commit, environment, passed/failed/skipped tests, residual risks, owners, and approvals. A skipped critical authentication, privacy, revocation, or recovery test blocks the gate. Alerting must detect purge failures, privileged access anomalies, and callback failure spikes without collecting raw personal payloads. Public aggregate reporting uses minimum group sizes and delayed totals to avoid identifying individual verification events.
