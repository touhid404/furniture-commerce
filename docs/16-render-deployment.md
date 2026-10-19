# Render deployment: one storefront and API origin

Render is the selected application host. The existing Express process serves the compiled React site from `backend/public/`, the API from `/api/v1`, and product redirects from `/media`. The separate Render worker processes the durable email and media-deletion outbox. Neon remains the PostgreSQL and object-storage provider. This deployment does not introduce a second frontend host, a CORS allowlist, a Render database, or a local upload disk.

## Before creating services

1. Review `config/stores/production.json`. It disables demo mode, but still contains sample KVIST branding, `support@example.com`, US/USD delivery/tax assumptions, policies and illustrative catalog products. Replace those with actual merchant values and explicit price books before accepting real orders. The saved admin Settings profile can override ordinary merchant fields, while this file controls deployment/security flags.
2. Replace the local-only `admin@ex.com` / `1234` account with a strong administrator password using `npm run admin:create` in a controlled environment. Enroll MFA; production middleware rejects the weak seed account.
3. Review migrations against the chosen Neon branch. Deploy only reviewed forward migrations using `npm run db:deploy` with the direct Neon URL. The Render image does not run migrations or seeds at startup.
4. Choose the public HTTPS origin. Set `PUBLIC_APP_URL` to the exact final origin, such as `https://your-store.onrender.com`, without a trailing path. This is used for email links, canonical URLs and request-origin checks.
5. Configure a working SMTP provider and sender. Without SMTP, customer email notifications stay queued; the worker still deletes unused media.

## Render Blueprint

Connect this private GitHub repository to Render and create a Blueprint from the root `render.yaml`. It defines an Ohio Docker web service (close to Neon's us-east-2 branch) and an Ohio Docker background worker. Both build the same reviewed Dockerfile. Automatic deployments are off until the merchant profile, credentials and release process are approved. The web service checks `/api/v1/health/ready` and binds to `0.0.0.0:$PORT`.

During the initial Blueprint setup, enter each `sync: false` value in Render's secret editor for **both** services. Use the `production` branch's pooled `DATABASE_URL`, its matching object-storage endpoint/region/key pair, the same long random `SESSION_SECRET`, the same 64-hex-character `MFA_ENCRYPTION_KEY`, and the same `PUBLIC_APP_URL`. The bucket is `assets`. Never paste these values into `render.yaml`, GitHub, or browser-side variables. For later secret changes, update each service in Render manually; `sync: false` only prompts during first Blueprint creation.

Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` to the **worker** service's Render environment after the provider is ready. The API does not send email itself. Keep the worker on a continuously running plan so queued jobs are processed. The Blueprint creates paid web and worker compute; review Render billing before creating it.

The image is built with `npm ci && npm run build`. That build writes the frontend files into ignored `backend/public/`; the Docker runtime copies that folder alongside the compiled Express server, Prisma client, JSON configuration and schema. Root `.env.local` is excluded from Docker and Git. Source control contains the build instructions, never a generated frontend build.

## Release verification

After deploying a reviewed commit, check these paths on the final HTTPS origin:

- `/api/v1/health/live` returns `200` with `status: ok`.
- `/api/v1/health/ready` returns `200` with `database: connected`.
- `/` and a deep link such as `/shop` return HTML whose script assets load from `/assets/`.
- `/api/v1/config` returns the intended brand/profile with `demo: false`.
- A published `/products/<slug>` page returns metadata and its `/media/<id>` image resolves.
- Sign-in, cart, COD quote and order confirmation work on the same origin; administrator routes require MFA and reject customer sessions.
- Worker logs show successful outbox processing after a controlled test notification. Check actual SMTP delivery before advertising emails.

If a service fails at startup, verify its `PUBLIC_APP_URL`, `STORE_CONFIG_PATH`, required secrets, Neon pooled URL, and storage credentials. If only HTML loads, check the `backend/public/` copy and the browser network requests for `/assets/`. If a browser reports an origin error, set `PUBLIC_APP_URL` to the exact address being used. A custom domain needs an intentional origin update and redeploy. Keep all production credentials in Render's secret manager, not in the frontend bundle.
