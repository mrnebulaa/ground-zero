# Security policy

**Do not deploy publicly or accept public submissions yet.** This milestone is a local prototype, not a production authentication or moderation system.

## Reporting

Use the repository's GitHub **Security → Report a vulnerability** option if enabled. Maintainers must enable private vulnerability reporting and publish a monitored alternative before public launch. If the option is unavailable, request a private contact channel without including exploit details, credentials, or personal records in a public issue. No response-time SLA is currently promised.

## Current controls and limitations

- Writes require a server-resolved user. Review status changes require the REVIEWER role; contributors can correct only their own claims. Roles are read from the database, never accepted from contribution forms.
- Development login requires an opt-in flag, development mode, and a secret of at least 32 characters. The role selector intentionally lets a developer test both roles. This is not suitable for multi-user or public access. Production rejects all development sessions.
- Sessions are signed, expire after eight hours, and use HttpOnly and SameSite=Strict. Cookies are deliberately not Secure for loopback HTTP. Production authentication must use secure cookies, revocation, rotation, and proper identity management.
- Next.js server actions provide same-origin checks; requests have a 128 KB body limit. Validation bounds content, strips unknown fields, and permits only HTTP(S) URLs without embedded credentials. Plain text is React-escaped; there is no HTML or Markdown rendering and no server-side fetching of submitted URLs.
- The database and app bind to loopback by default. The app does not log submitted secrets. Keep secrets in ignored environment files. Do not put credentials, private tokens, or personal data in URLs or submitted text; query-string secrets cannot be reliably detected automatically.
- Private moderation notes and audit rows are not included in public query results. There is no moderation/admin endpoint yet. Database owners still have direct access and must protect it.
- Transactions keep claim versions, evidence, history, and audit writes consistent. Optimistic version checks prevent lost corrections/reviews. There is no application history-edit or deletion endpoint; database administrator changes are not cryptographically tamper-evident.

## Dependency review

The initial dependency audit identified PostCSS and deepmerge-ts findings; patched versions are selected through package overrides and verified with migration/build/tests. Review and remove overrides when upstream dependencies incorporate the fixes. A remaining high-severity `braces` stack-exhaustion advisory propagates through the ESLint/Next lint toolchain; no patched braces release was available during implementation. Lint patterns are repository-controlled, and this parser is not used to process claim input. Track the upstream fix and rerun `npm audit`; this is an unresolved toolchain risk, not an assertion that the application has been security-audited.

## Required before public launch

Production authentication and abuse controls; role provisioning and conflict-of-interest policies; rate limits and spam defense; a CSP suited to Next.js; authorization review and penetration testing; moderation reporting and appeals; lawful privacy/redaction and retention procedures; backup/restore drills; dependency updates; and accessibility review. Sensitive moderation workflows must receive explicit review before implementation or exposure.
