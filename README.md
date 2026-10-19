# Furniture commerce platform

React frontend, Express backend, PostgreSQL on Neon, and Prisma. The storefront, customer and admin applications share a reviewed commerce API. See the release verification report for measured results and deployment prerequisites.

The supplied video controls the visual design. Store variables belong in validated JSON. Current payment scope is **cash on delivery only**; online payments must display “coming soon.” SSLCommerz integration is deferred.

The storefront, customer workflows, admin screens and commerce backend are implemented; acceptance results are recorded in the release report. The [implementation status](docs/13-implementation-progress.md) and [operator guide](docs/14-operator-guide.md) distinguish verified behavior from external launch setup. Main is updated through the reviewed pull request after acceptance checks.

## Read first

- [Complete editable specification](docs/deliverables/Furniture-Commerce-Specification.docx)
- [Scope and requirements](docs/01-product-requirements.md)
- [Video design specification](docs/02-video-design-specification.md)
- [Storefront and admin workflows](docs/03-functional-specification.md)
- [Architecture and project structure](docs/04-architecture.md)
- [Database and transaction design](docs/05-data-design.md)
- [API contract and endpoint catalog](docs/06-api-specification.md)
- [JSON configuration and localization](docs/07-configuration.md)
- [Store JSON editing guide](config/README.md)
- [Security deployment and operations](docs/08-security-and-operations.md)
- [Acceptance tests and implementation plan](docs/09-delivery-and-acceptance.md)
- [Open decisions and next inputs](docs/10-decisions.md)
- [GitHub workflow](docs/11-github-workflow.md)
- [Verified Neon setup report](docs/12-neon-setup-report.md)
- [Release verification and measured performance](docs/15-release-verification.md)
- [Render deployment of the combined frontend and backend](docs/16-render-deployment.md)

## Supporting artifacts

- [OpenAPI route inventory and critical-flow schemas](docs/contracts/openapi.json) — 87 implemented operations, with validated DTOs in backend modules.
- [Example store profile](docs/config/store.example.json) and [JSON Schema](docs/config/store.schema.json) — example market data, not the chosen launch market.
- [Backend environment template](docs/config/backend.env.example) — contains no real credentials.
- [Reference capture index](docs/reference/README.md) — four cropped screens and 47 timestamped frames.
- [Documentation validation](docs/internal/validation-report.md).

## Project structure

```text
frontend/                     React application and Vite configuration
backend/src/modules/          Express auth, catalog, commerce and admin routes
backend/src/services/         Transactions, stock operations and calculations
backend/public/               Generated React build, ignored by Git
backend/prisma/schema/        Generator, datasource and shared enums
backend/prisma/schema/models/ One Prisma schema file per table
backend/prisma/migrations/    Reviewed SQL migration history
config/stores/                Validated store profiles
scripts/                      Setup, administration and validation
tests/                       Unit and browser checks
```

## Development setup

Use Node 24 and run `npm ci`. Keep `.env*` credentials and `.neon` ignored. Fixture verification uses a short-lived isolated `test-*` Neon branch; its credentials are injected into test processes without changing `.env.local`. The finished app uses one ignored `.env.local`. Deployment-injected environment values take priority over files. Keep a single local file; the loader does not read alternate `.env` files.

The owner selected the Neon `production` branch for the app. Its database and `assets` credentials belong together in `.env.local`. Use [the environment template](docs/config/backend.env.example) for variable names. Run `npm run db:deploy` for reviewed forward migrations only. Run `npm run seed` for the idempotent product catalog and environment-configured administrator defined in [the seed folder](backend/prisma/seeds/README.md); it creates no historical orders and never resets the database. The owner will delete the old development branch personally.

Run `npm run dev` and open [the development frontend](http://127.0.0.1:5173). Or run `npm run build` followed by `npm start` and open [the compiled application](http://127.0.0.1:3001). The API is under `/api/v1`. `npm run worker` starts the separate email outbox worker; SMTP credentials are needed for delivery.

Run `npm test`, `npm run build`, `npm run check:docs`, `npm run check:config` and `npm run prisma:validate`. `npm run test:db` checks the deliberately configured database. For browser acceptance: use `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` with installed Chrome, or install Playwright Chromium. Commerce browser, API concurrency, storage and SMTP acceptance are part of the release checks.

The active [JSON store profile](config/stores/default.json) uses explicitly labeled demo settings and sample US/USD data. Configure real merchant rules and production credentials before launch.

For deployment, `npm run build` places the React site in `backend/public/`. Express serves that folder and the API on one origin. The [single Render Web Service guide](docs/16-render-deployment.md) uses the root Dockerfile, with the outbox worker in the web process; the [production profile](config/stores/production.json) disables demo mode but still needs real merchant details.

## Confirmed project choices

React frontend, Express backend, PostgreSQL with Prisma, Neon database hosting, customer and main-admin experiences, cash on delivery with online payment deferred, full production scope, and store variables kept in JSON. Branding, country, language and currency must be configurable for different store owners.

One merchant per deployed instance is the documented baseline. JSON profiles make the project reusable for another owner; running many merchants in one database is a separate architecture decision. No Neon credential is needed to review these documents. PostgreSQL connection strings stay in the backend environment; a Neon management API key is not needed for normal database queries. The repository is private at [touhid404/furniture-commerce](https://github.com/touhid404/furniture-commerce). Analysis images and the video stay local.

## Troubleshooting local startup

Run `npm run dev` from the project root to start both Express (3001) and Vite (5173). Starting only the frontend still requires the current backend. If the page reports “API endpoint not implemented,” an older API process is still listening on port 3001: stop that process and restart the current backend. `npm run dev:api` runs only the API; `npm run dev:web` runs only Vite. Keep database and storage values together in root `.env.local`.

## Shopping and administrator access

The shopping bag updates synchronously in local storage, including quantities, subtotal and badge. Checkout redirects guests to sign-in and returns them with their bag intact. The backend rechecks prices and stock; changes require another review. Successful orders allocate stock atomically and use an idempotency key. Failed checkout preserves the local bag.

The original reset-created local testing account used username `admin`, password `1234`; production rejected it. Put `ADMIN_EMAIL=admin@ex.com`, `ADMIN_USERNAME=admin` and the owner-selected `ADMIN_PASSWORD` in the ignored root `.env.local`. `npm run seed` creates a missing administrator without changing an existing password; `npm run admin:create` explicitly creates or rotates it. Both commands store an Argon2 hash. Changing the environment file alone does not change an existing account, and login verifies the stored hash rather than reading the environment password. Never commit credentials.

Page loaders use content skeletons. Product photos have bounded dimensions and 480px WebP card derivatives. Flying product animations last 1.05 seconds, respect reduced motion and never delay cart updates. Existing colors are preserved; spacing follows a 4px rhythm.

Promotion codes validate against server-owned price books before the bag shows savings. `WELCOME10` is included in the sample seed: 10% off eligible USD bags of at least $100, limited to 100 orders. The preview does not redeem the code; successful checkout increments usage atomically. Quantities and refreshes recalculate the displayed savings.

Checkout checks delivery, stock and totals automatically after valid delivery details are entered. The single **Confirm order** button submits the COD order. Tracking at `/order-access` finds saved orders by order number within the signed-in account; legacy private access links remain supported.

Admin sessions open `/admin` directly; normal customers cannot open any admin screen or API. All admin routes use the shared backend authorization middleware, including nested media and CSV exports. Admin lists use server pagination and search. Destructive and other administrative changes, including sign-out, require a confirmation dialog. Settings offers simple store/delivery fields with validated JSON persistence and revision conflict protection; internal mode/security flags stay out of the form.
