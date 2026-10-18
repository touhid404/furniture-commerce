# Furniture commerce platform

React frontend, Express backend, PostgreSQL on Neon, and Prisma. Implementation is in progress; the editable specification is a version 0.1 planning snapshot from 18 October 2026.

The supplied video controls the visual design. Store variables belong in validated JSON. Current payment scope is **cash on delivery only**; online payments must display “coming soon.” SSLCommerz integration is deferred.

The storefront, customer workflows, admin screens and commerce backend are implemented and undergoing full acceptance. The [implementation status](docs/13-implementation-progress.md) and [operator guide](docs/14-operator-guide.md) distinguish verified behavior from external launch setup. The feature branch remains unmerged until acceptance is complete.

## Read first

- [Complete editable specification](docs/deliverables/Furniture-Commerce-Specification.docx)
- [Scope and requirements](docs/01-product-requirements.md)
- [Video design specification](docs/02-video-design-specification.md)
- [Storefront and admin workflows](docs/03-functional-specification.md)
- [Architecture and project structure](docs/04-architecture.md)
- [Database and transaction design](docs/05-data-design.md)
- [API contract and endpoint catalog](docs/06-api-specification.md)
- [JSON configuration and localization](docs/07-configuration.md)
- [Security deployment and operations](docs/08-security-and-operations.md)
- [Acceptance tests and implementation plan](docs/09-delivery-and-acceptance.md)
- [Open decisions and next inputs](docs/10-decisions.md)
- [GitHub workflow](docs/11-github-workflow.md)
- [Verified Neon setup report](docs/12-neon-setup-report.md)

## Supporting artifacts

- [OpenAPI contract for the critical shopping flow](docs/contracts/openapi.json) — deliberately scoped; the full endpoint inventory is in the API specification.
- [Example store profile](docs/config/store.example.json) and [JSON Schema](docs/config/store.schema.json) — example market data, not the chosen launch market.
- [Backend environment template](docs/config/backend.env.example) — contains no real credentials.
- [Reference capture index](docs/reference/README.md) — four cropped screens and 47 timestamped frames.
- [Documentation validation](docs/internal/validation-report.md).

## Project structure

```text
frontend/                     React application and Vite configuration
backend/src/modules/          Express auth, catalog, commerce and admin routes
backend/src/services/         Transactions, stock operations and calculations
backend/prisma/schema/        Generator, datasource and shared enums
backend/prisma/schema/models/ One Prisma schema file per table
backend/prisma/migrations/    Reviewed SQL migration history
config/stores/                Validated store profiles
scripts/                      Setup, administration and validation
tests/                       Unit and browser checks
```

## Development setup

Use Node 24 and run `npm ci`. Keep `.env*` credentials and `.neon` ignored. Verification uses an isolated Neon development branch; temporary branch settings are used only during verification. The finished app uses one ignored `.env.local`. Deployment-injected environment values take priority over files. `APP_ENV_FILE` can select another ignored environment file.

For a new checkout, link the authorized Neon project, create/select a development branch, and pull its environment before applying migrations. Never migrate production as a development setup step. Use [the environment template](docs/config/backend.env.example) for the required variables. Run `npm run db:deploy` only after confirming that the selected database is the intended development branch. `DEMO_SEED=true npm run db:seed` adds fictional catalog and operational records only when the store profile is in demo mode.

Run `npm run dev` and open [the development frontend](http://127.0.0.1:5173). Or run `npm run build` followed by `npm start` and open [the compiled application](http://127.0.0.1:3001). The API is under `/api/v1`. `npm run worker` starts the separate email outbox worker; SMTP credentials are needed for delivery.

Run `npm test`, `npm run build`, `npm run check:docs`, `npm run check:config` and `npm run prisma:validate`. `npm run test:db` checks the deliberately configured database. For browser acceptance: use `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` with installed Chrome, or install Playwright Chromium. Commerce browser, API concurrency, storage and SMTP acceptance are part of the release checks.

The active [JSON store profile](config/stores/default.json) uses explicitly labeled demo settings and sample US/USD data. Configure real merchant rules and production credentials before launch.

## Confirmed project choices

React frontend, Express backend, PostgreSQL with Prisma, Neon database hosting, customer and main-admin experiences, cash on delivery with online payment deferred, full production scope, and store variables kept in JSON. Branding, country, language and currency must be configurable for different store owners.

One merchant per deployed instance is the documented baseline. JSON profiles make the project reusable for another owner; running many merchants in one database is a separate architecture decision. No Neon credential is needed to review these documents. PostgreSQL connection strings stay in the backend environment; a Neon management API key is not needed for normal database queries. The repository is private at [touhid404/furniture-commerce](https://github.com/touhid404/furniture-commerce). Analysis images and the video stay local.
