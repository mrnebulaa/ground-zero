# Contributing

Contributions from different viewpoints are welcome. Read the [charter](CHARTER.md), [community rules](CODE_OF_CONDUCT.md), and [security policy](SECURITY.md).

1. Discuss major scope changes in an issue. Use a feature branch and a pull request; never commit directly to main.
2. Follow the README setup. Keep domain behavior in `lib/claims.ts`, validation in `lib/validation.ts`, and transport/UI concerns in `app/`.
3. Include a committed Prisma migration for schema changes. Preserve attribution, correction history, and private audit boundaries.
4. Add meaningful tests for changed behavior, especially authorization, transactional integrity, and untrusted input. Run lint, type checking, unit/integration tests, build, and relevant browser tests.
5. Explain the problem, behavior change, verification, and meaningful security/accessibility tradeoffs in the PR. Never include credentials, private data, or real-world claims disguised as test evidence.
6. Maintain accessible labels, keyboard focus, responsive layouts, plain language, and visible error feedback. Do not introduce profiling, popularity ranking, or partisan governance rules.
7. By contributing, you agree that your contribution is distributed under AGPL-3.0-or-later. Maintainers assess consistency with the charter and engineering quality, not political affiliation.

Security reports belong in a private reporting channel, not a public issue containing exploit details.
