# Code Reviewer Memory

- [Env loading is implicit via Prisma](project_env_loading.md) — no dotenv dep; JWT_SECRET/GOOGLE_CLIENT_ID rely on Prisma's .env side-effect load, order-fragile.
