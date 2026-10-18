# Product seed

Edit `products.json` to define products, categories, stock and explicit market price books. Normal `npm run seed` creates missing products by unique slug and SKU, leaves existing products (including administrator edits and current stock) unchanged, and creates no users or orders. It never resets the database. To change an existing product use the admin dashboard or a reviewed data migration.

Seed photographs are downloaded from the explicit approved HTTPS sources, validated with the same decoder used by admin uploads, then stored in the current Neon branch's private `assets` bucket. The database stores `/media/<id>` and object keys, never image binaries or expiring signed URLs. Card derivatives are 480px WebP; originals remain available for detail views. Temporary source files are cached outside the repository. Do not commit local caches or generated analysis images.

Photographs: [Unsplash license](https://unsplash.com/license). These are sample catalog products with illustrative real photographs, not verified merchant stock or manufacturer specifications. Replace them with the merchant's own product information and photography before selling.

Preparation without database writes:

```sh
npx tsx backend/prisma/seeds/index.ts --prepare
```

The active profile must have an explicit price book for every listed market; no currency conversion is inferred. A missing or mismatched book aborts before database changes.

Destructive resets are deliberately separate (`npm run db:reset`). They require the project, branch and verified host, and a separate production override. Never automate this command in deployment or CI. The owner approved the one-time production reset on 2026-10-18; this is not continuing permission for later resets. The reset-created `admin` / `1234` account is restricted to local demo runtime and must be replaced before production runtime.
