# Security policy

**Do not deploy publicly or accept public submissions yet.** Passkey authentication is implemented for isolated testing; public rollout and operational moderation are not approved.

## Reporting

Use the repository's GitHub **Security → Report a vulnerability** option if enabled. Maintainers must enable private vulnerability reporting and publish a monitored alternative before public launch. If the option is unavailable, request a private contact channel without including exploit details, credentials, or personal records in a public issue. No response-time SLA is currently promised.

## Current controls and limitations

- Writes require a server-resolved user. Review status changes require the REVIEWER role; contributors can correct only their own claims. Roles are read from the database, never accepted from contribution forms.
- Development login requires an opt-in flag, development mode, and a secret of at least 32 characters. The role selector intentionally lets a developer test both roles. This is not suitable for multi-user or public access. Production rejects all development sessions.
- Legacy development sessions are signed, expire after eight hours, and use HttpOnly and SameSite=Strict. Cookies are deliberately not Secure for loopback HTTP. They are not accepted in production. Passkey sessions instead use hashed opaque tokens and Secure HttpOnly cookies.
- Next.js server actions provide same-origin checks; requests have a 128 KB body limit. Validation bounds content, strips unknown fields, and permits only HTTP(S) URLs without embedded credentials. Plain text is React-escaped; there is no HTML or Markdown rendering and no server-side fetching of submitted URLs.
- The database and app bind to loopback by default. The app does not log submitted secrets. Keep secrets in ignored environment files. Do not put credentials, private tokens, or personal data in URLs or submitted text; query-string secrets cannot be reliably detected automatically.
- Private moderation notes and audit rows are not included in public query results. There is no moderation/admin endpoint yet. Database owners still have direct access and must protect it.
- Transactions keep claim versions, evidence, history, and audit writes consistent. Optimistic version checks prevent lost corrections/reviews. There is no application history-edit or deletion endpoint; database administrator changes are not cryptographically tamper-evident.

## Dependency review

The locked dependency set reports no known vulnerabilities in `npm audit` as of 2026-10-23. PostCSS and deepmerge-ts overrides retain earlier fixes; review and remove them when upstream dependencies incorporate those fixes. Automated advisory checks are not an independent security audit.

## Required before public launch

Independent review of passkey authentication and stronger abuse controls; role provisioning and conflict-of-interest policies; rate limits and spam defense; a CSP suited to Next.js; authorization review and penetration testing; moderation reporting and appeals; lawful privacy/redaction and retention procedures; backup/restore drills; dependency updates; and accessibility review. Sensitive moderation workflows must receive explicit review before implementation or exposure.

## Milestone 2B limits

SimpleWebAuthn performs WebAuthn cryptographic verification with required user verification, fixed RP/origin, and browser-bound expiring challenges. New auth APIs accept only same-origin JSON POSTs, bound request bodies, and return no-store responses. Account locks serialize credential/session/recovery mutations; claim writes recheck member sessions within their database transaction. Registration is default-off. No production reviewer/moderator role provisioning is implemented.

Authentication has no shared global quota. Anonymous requests receive separate per-action network budgets: 60/minute for login and other actions (begin/finish share their action), 20/15 minutes for registration or recovery, plus five recovery requests per network/username pair per 15 minutes. Invalid guesses cannot consume an account-wide recovery quota. Verified sessions use per-account/action budgets (30/minute, 120/minute for account reads), isolated from anonymous traffic; recovery initiation also retains network/pair limits. Login, cancellation, logout, and recovery have separate budgets. Limits are atomic, saturating, return HTTP 429 with Retry-After, and reset at fixed-window boundaries.

Outside loopback development, anonymous auth fails closed unless `AUTH_TRUST_PROXY=true` and a trusted reverse proxy **overwrites** `X-GZ-Client-IP` with exactly one validated client address. The app port must be inaccessible directly; never forward an incoming client-supplied value. Forwarded/X-Forwarded-For chains are not trusted. Test this boundary before any rollout. Local development ignores supplied network headers by default. IPv4 addresses and IPv6 /64 prefixes are used transiently, never logged or stored. Domain-separated HMAC-SHA256 maps each identifier to one of 65,536 counter slots per action/lane, changing the mapping each 1- or 15-minute window. Only slot, capped count, and expiry are stored, with at most 25 slot namespaces (1,638,400 rows); hourly pruning removes expired counters. No permanent IP tracking or device fingerprinting is introduced; proxy logging needs a separate privacy review.

Shared NATs, rare slot collisions, and fixed-window boundary bursts remain tradeoffs. Distributed networks and authenticated account farms can still consume service/database capacity; this is not DDoS protection or sufficient public-launch abuse prevention. Throttling unauthenticated recovery cannot guarantee availability to a victim sharing an attacker's network. A stolen valid recovery code can still temporarily lock out its owner: concurrent initiation consumes only one code, pending retries cannot extend the hold, and original-passkey cancellation invalidates all codes, replacements, and sessions. Expiry rejects restricted sessions without restoring revoked sessions or account privileges; an original passkey can still contest, or another unused code can restart the hold. No off-device alert is delivered. Unknown accounts, invalid codes, suspension, and pending recovery share a generic initiation error, without claiming timing indistinguishability. Username availability remains public. Device/cloud-passkey compromise, browser extensions, proxy misconfiguration, and XSS require independent testing. This integration has not received an independent audit.

Session-cookie removal alone does not authenticate anyone. A lost session cannot be recovered through an administrator. Recovery sessions cannot contribute, remove keys, or generate codes; only an original-passkey CONTEST session can cancel. No automatic grant restoration follows recovery. Counter anomalies reject the ceremony without banning the account. Recovery HMAC-key rotation currently invalidates all old codes rather than supporting a key ring.

No credential-change audit/notification delivery service, production CSP, scheduled cleanup monitor, complete deletion/export/backup-restoration workflow, or full browser/device and assistive-technology audit is shipped. Run pruning explicitly and test physical security keys, synced devices, keyboard and screen readers before rollout. Source links and public content retain Milestone 1 privacy limitations. Do not enable public registration or deploy until these protections receive human security/privacy/accessibility review.
