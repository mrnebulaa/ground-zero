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

## Milestone 1 review follow-up

The follow-up review added normalized-URL/null-character validation, stable shared-source upserts, an audit foreign key, and regression coverage. Both migrations applied to a new empty PostgreSQL cluster; schema drift comparison reported no differences.

Results: 23 unit tests, 10 PostgreSQL integration tests, the development browser workflow, and the production authentication browser test passed. The production test uses an existing reviewer record and correctly signed session while the development flag and matching secret are configured; login and submission remain unavailable. Lint, type checking, formatting, and production build passed. The full limitation inventory is in [MILESTONE_1_REVIEW.md](MILESTONE_1_REVIEW.md).

The original PR CI run [39889464243](https://github.com/mrnebulaa/ground-zero/actions/runs/39889464243) passed. Updated-head CI results are recorded in the PR after the review commit is pushed, avoiding a circular commit-SHA reference in this file. No merge or public deployment was performed.
