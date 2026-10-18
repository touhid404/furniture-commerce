# Furniture commerce project documentation

Professional requirements and implementation specification for a React storefront and admin application, an Express API, and PostgreSQL on Neon accessed through Prisma. Version 0.1, 18 October 2026.

The reference video controls the visual design of the screens it shows. The specification covers a complete production launch, online card payments and cash on delivery, and reusable JSON store profiles. The current application is a verified React/Express/Prisma connectivity foundation connected to the requested Neon Postgres branch. The commerce storefront and admin features are specified but not yet implemented.

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

## Run the foundation

Use Node 24. Run `npm ci`, then `npx neon@latest init -y --org-id org-summer-unit-14920623 --project-id quiet-boat-96833475 --branch production --services postgres` only when this checkout is not already linked. Finish Neon sign-in if requested, and run `npx neon@latest deploy` to pull local environment values. Keep `.env.local` and `.neon` ignored.

Run `npm run build` and `npm start`, then open [the local foundation](http://127.0.0.1:3001). For frontend/API hot reload, use `npm run dev` and open [the Vite development app](http://127.0.0.1:5173). The page verifies React to Express to Prisma to Neon with a read-only query. It is a development setup screen, not the completed commerce design.

Run `npm run check:docs`, `npm run check:config`, `npm test`, `npm run prisma:validate` and `npm run test:db`. For browser verification install a Playwright browser with `npx playwright install chromium`, or use `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` if Chrome is installed. The production database check does not create or modify tables.

The active profile is [config/stores/default.json](config/stores/default.json). It is deliberately marked development with unconfigured commerce integrations; use it as a template, not a launch-ready country choice.

## Confirmed project choices

React frontend, Express backend, PostgreSQL with Prisma, Neon database hosting, customer and main-admin experiences, card payments plus cash on delivery, full production scope, and store variables kept in JSON. Branding, country, language and currency must be configurable for different store owners.

One merchant per deployed instance is the documented baseline. JSON profiles make the project reusable for another owner; running many merchants in one database is a separate architecture decision. No Neon credential is needed to review these documents. PostgreSQL connection strings stay in the backend environment; a Neon management API key is not needed for normal database queries. The repository is private at [touhid404/furniture-commerce](https://github.com/touhid404/furniture-commerce). Analysis images and the video stay local.
