# Contributing

Keep the reference design, documented business rules and implementation aligned. Start from an issue or a clearly scoped change, work on a feature branch, and open a pull request with relevant evidence. Keep generated analysis images and local credentials out of Git.

## Branch and commit conventions

Use `feat/<topic>`, `fix/<topic>`, `docs/<topic>` or `chore/<topic>` branches from `main`. Use focused Conventional Commit subjects such as `feat(checkout): reserve stock atomically` or `docs: specify card refund lifecycle`. Do not force-push shared branches. Update documentation and contracts with behavior changes. Use a feature database branch for schema work; the initial production connection probe is read-only.

## Required checks

Run `npm ci`, `npm run check:docs`, `npm run check:config`, `npm test` and `npm run build`. Real-database verification uses `npm run test:db` only with a deliberately selected environment. Browser/database checks use `npm run test:e2e`. CI builds without production credentials; integration tests belong on an isolated test branch. Never place a production database URL in ordinary pull-request CI.

## Pull requests and releases

Use the PR template, link the issue, describe the problem and final behavior, and record meaningful validation. Include migration, configuration and rollback impact. For visual changes use local review evidence or approved design assets; do not upload the extracted analysis frames. Review stock, money, permissions and provider idempotency for commerce changes. Resolve review threads and passing checks before squash merge. Do not claim a human review occurred when none did.

Tag versioned releases after release acceptance, and update CHANGELOG with customer/admin changes, migrations and known limitations. Keep `main` releasable at its current stage; the connectivity foundation is not a production commerce release. Required review/status enforcement depends on GitHub plan support for private repositories and must be verified in repository settings before claiming it is enforced.
