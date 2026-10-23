# Implementation roadmap and approval gates

This PR approves no implementation or deployment. Each phase requires a separate reviewed change with evidence against the testing plan. No provider SDK, production migration, account collection, or registration flag is added here.

| Phase                        | Deliverable after approval                                                                                                                  | Exit criteria                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A — design approval          | Resolve recovery loss tradeoff, role-suitability alternatives, steward/approver governance, RP domains, privacy schedule, provider criteria | Maintainer, security, privacy, accessibility, and community-governance sign-off; unresolved owners recorded                                |
| B — internal authentication  | Passkeys, canonical pseudonyms, hashed revocable sessions, recovery codes; synthetic/internal accounts only                                 | Protocol and recovery/concurrency tests, accessible hardware-key flow, no public signup, no production dev-auth fallback                   |
| C — policy integration       | Account-state/permission service, scoped grants, dual approvals, restrictions/appeals, private audit and notices                            | Negative authorization matrix, review conflicts, training expiry, revocation ordering, same rules for staff                                |
| D — lifecycle readiness      | Deletion/export/purge/restore jobs, redaction procedure, operator segregation, monitored incident and appeal processes                      | Prove erased data cannot reappear on restore; launch privacy notice and staffing approved                                                  |
| E — invitation L1 pilot      | Limited registration only after a separate explicit launch approval                                                                         | Rate/abuse metrics without profiling, manual false-positive review, accessible recovery, rollback drill; evidence regressions remain green |
| F — optional attestation     | Isolated broker with synthetic signed fixtures first; select provider only through separate approval                                        | Contract/privacy review, strict minimal assertion, owner-only state, revocation/withdrawal drills; no document intake                      |
| G — approved L3 appointments | Trained reviewers/moderators with verified suitability, two-person approval, expiring grants                                                | No self-approval, no ordinary moderator receipt access, appeals ready, public scope notices, independent oversight                         |

L3 framework can be tested before a real L2 provider using the approved alternative suitability process; no pilot member automatically becomes staff. B–G are future implementation proposals, not permission to proceed from this design request.

## Compatibility and rollout

Preserve anonymous GETs without signup walls, cookies, or identity-dependent content ranking. Existing sources, revision snapshots, status semantics, and transactional evidence service remain authoritative. Extend authentication/policy at the service boundary; never add private verification attributes to claim-service inputs. New credential/store migrations must be additive first, preserve IDs/FKs, and have tested rollback. Do not migrate the shared development secret or local reviewer identities into production membership.

Keep separate flags for registration, provider requests, and privileged grant issuance, all default-off. Disabling registration does not strand existing members; disabling the provider preserves L1 and lets eligibility leases expire safely. Incident rollback closes affected writes, revokes sessions/grants as appropriate, preserves anonymous reads and history, and never falls back to development authentication.

## Open decisions requiring named owners

- Security lead: RP ID/origins, cryptographic library review, recovery delay usability, token/key rotation, step-up defaults, two-person bootstrap.
- Privacy lead: applicable jurisdictions, provider regions/subprocessors, retention/holds, public pseudonym tombstones versus erasure, narrow ban-token necessity.
- Community governance: suitability criteria, reference route fairness, appeals staffing, training content, conflict policy, 90-day term renewal.
- Accessibility lead: browser/device matrix, no-biometric alternatives, assisted setup without credential custody, recovery code accessibility.
- Maintainers: operational staffing, initial invitation limits and measured quota thresholds, independent security review budget.

No guarantee of perfect uniqueness, ban prevention, legal compliance, or account recovery is asserted. If privacy/accessibility requirements cannot be met by a provider, L2 remains unavailable rather than weakening L1 rights.
