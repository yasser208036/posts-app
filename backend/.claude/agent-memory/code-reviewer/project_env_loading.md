---
name: project-env-loading
description: Backend has no dotenv; env vars for auth are loaded as a side effect of @prisma/client reading .env
metadata:
  type: project
---

The backend does not depend on `dotenv` and never calls `dotenv.config()`. The `.env` file (containing `DATABASE_URL`, and meant to hold `JWT_SECRET` / `GOOGLE_CLIENT_ID`) is loaded into `process.env` only as a side effect of importing `@prisma/client`, which reads `.env` when the client module initializes.

**Why:** The Prisma migration introduced `.env` for `DATABASE_URL`. Prisma's runtime auto-loads `.env`, so `DATABASE_URL` is PRESENT at runtime without an explicit loader. But `JWT_SECRET` and `GOOGLE_CLIENT_ID` are read at module-eval time in `auth/jwt.ts` and `auth/auth.controller.ts`.

**How to apply:** This coupling is fragile and order-dependent — if those modules evaluate their `process.env.X` reads before `@prisma/client` is imported, they silently fall back to insecure defaults (`dev-only-insecure-secret`). Recommend an explicit `import "dotenv/config"` at the top of `server.ts` rather than relying on Prisma. Flag this whenever env-var reads are added.
