# Project instructions

Build the furniture storefront and admin platform from the supplied reference and the specifications in `docs`. Use React, Express, PostgreSQL and Prisma. Keep the reference composition; unseen pages extend the same style. Do not claim an unspecified or unimplemented feature is present.

Owner-specific branding, countries, currencies, locales, themes and operational variables belong in validated JSON. Use explicit price books when switching currency. Keep credentials server-side in ignored environment files. The active profile is `config/stores/default.json`.

Maintain GitHub professionally: use focused feature branches, meaningful commits, issue/requirement traceability, passing checks and pull requests. Keep changelog and contracts aligned. Do not push analysis images, video frames, render previews, test screenshots, the source video, `.env*` credentials, `.neon`, dependencies or generated clients. Approved product assets are separate from analysis images and may be versioned when supplied.

The initial Neon connection uses the user-selected production branch. Connectivity checks are read-only. Use a separate development branch and reviewed migrations for commerce schema work. Never reset production or run destructive schema pushes.

Run checks appropriate to the change. `npm run build`, `npm test`, `npm run check:config`, `npm run check:docs` and `npm run prisma:validate` cover the foundation. `npm run test:db` and browser E2E require deliberately configured live credentials and must not run on untrusted PRs against production.

Use root folders named `frontend/` and `backend/`. Prisma lives in `backend/prisma/schema/`, with one model file per table under `models/`; the main file contains only generator and datasource declarations.

Current payment scope is cash on delivery only. Show online payments as coming soon; defer SSLCommerz integration. Commit and push each verified milestone to the feature branch. Merge into `main` only after the full project and acceptance checks are complete.

The owner has authorized consolidating the finished app onto the existing Neon `production` branch, including reviewed forward migrations and the `assets` bucket, then removing only the temporary development branch created for this task after verification. Preserve existing production data and objects. Keep exactly one root local environment file, `.env.local`; never commit it. Subsequent fixture tests must use a temporary isolated branch and must refuse production writes.
