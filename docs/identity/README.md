# Milestone 2A — gradual identity verification design

Status: **proposal for review; not implemented or approved for launch**. This package changes documentation only. No migrations, provider integration, document intake, or public registration are enabled. Milestone 1's anonymous reads and evidence engine remain unchanged.

## Deliverables

1. [Identity architecture](ARCHITECTURE.md)
2. [Threat model](THREAT_MODEL.md)
3. [Authorization matrix](AUTHORIZATION.md)
4. [Database schema proposal](SCHEMA.md)
5. [Registration and recovery flows](FLOWS.md)
6. [Privacy, retention, deletion, and export](PRIVACY.md)
7. [Implementation roadmap and approval gates](ROADMAP.md)
8. [Security testing plan](TESTING.md)

## Policy and decisions for approval

The four levels are policy concepts, not an ascending database role enum. L0 is anonymous reading; L1 is passkey membership with a persistent public pseudonym; L2 is optional private verification; L3 is a separately approved, trained, time-limited reviewer or moderator appointment. L2 never grants moderation/review powers or preferential factual credibility. L3 need not reveal whether someone used L2: role-suitability verification may follow an approved alternative reference-based route. All levels follow the same community rules.

Proposed defaults requiring explicit approval: no public L2 badge; one active pseudonym per account; recovery by a second passkey or an offline single-use code with a 24-hour hold; no email-only or identity-provider-based recovery; 90-day privileged grants; separate verification broker and database credentials; the exact retention and session limits below. No vendor, jurisdictional compliance conclusion, or proof-of-personhood guarantee is selected here.

## Requirement traceability

| Requirement                                                                | Design location / acceptance gate                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Private verification hidden from members/moderators                        | Architecture boundaries; authorization matrix; negative disclosure tests |
| No ID scans, legal names, or biometric verification records in Ground Zero | Schema exclusions; no document intake; ingress/log/export tests          |
| Separate authentication, identity, reputation, evidence                    | Architecture domains; no verification field in claim service inputs      |
| Revocable sessions and recovery                                            | Architecture sessions; recovery diagram; replay/revocation tests         |
| Impersonation, mass signup, ban evasion                                    | Threat model; proportional controls and false-positive appeals           |
| Logging, retention, deletion/export                                        | Privacy table, owner and purge/restore tests                             |
| Human approval for privileges                                              | Dual-approval grant protocol and training expiry                         |
| Same rules                                                                 | Authorization restrictions precede all grants; no L2 immunity            |
| Challenge verification errors/restrictions                                 | Privacy appeals and independent review; recovery is separate             |
| Preserve anonymous reading/evidence                                        | Roadmap migration compatibility and regression gates                     |

## Primary references

Consulted October 22, 2026. These inform technical design, not a claim of certification or legal compliance:

- [W3C WebAuthn Level 3](https://www.w3.org/TR/webauthn-3/): relying-party-scoped credentials and verification protocol. Use maintained protocol libraries and conformance tests, not bespoke cryptography.
- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html): authenticator lifecycle and recovery guidance. Ground Zero is not claiming a NIST assurance level.
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): server-side session lifecycle and cookie protections.

All timeout/retention numbers and governance processes in this package are Ground Zero proposals, not requirements attributed to these references.
