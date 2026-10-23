# Milestone 1 verification

Verified locally on October 22, 2026 (America/Chicago):

- ESLint, TypeScript, Prettier, and `git diff --check`: passed.
- Unit tests: 13 passed (input bounds, unsafe URLs, duplicate sources, signed sessions, production fail-closed behavior, role checks).
- PostgreSQL integration tests: 6 passed (atomic creation/history/audit, permissions, correction snapshots, stale reviews, duplicate attachment rollback, missing-claim rollback, concurrent reviews).
- Initial SQL migration applied successfully to a fresh database.
- Production Next.js build: passed.
- Playwright browser workflow: passed (anonymous submission gate, local contributor login, submission, safely rendered hostile text, correction, sign-out, reviewer login, review, evidence attachment resetting review, and mobile overflow check). Desktop claim and mobile library screenshots inspected.
- `npm audit --omit=dev`: zero reported vulnerabilities. Full audit: five high-severity dependency entries from the same unresolved development-only `braces` advisory; see SECURITY.md.

The local host used Node 26.5 and temporary PostgreSQL 18.4 because the Docker daemon was unavailable. Chromium was an existing Playwright runtime (revision 1234), selected via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, after downloading the pinned browser failed. CI is configured for Node 22, PostgreSQL 17, and the lockfile's Playwright browser; a local pass does not establish the result of that remote run.

Only fictional fixtures were used in a disposable test database. No public deployment, registration, or real-world evidence import was performed. These checks do not replace an independent security, moderation, or accessibility review before public launch.
