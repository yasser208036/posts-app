# Posts App

Social posts app: create posts (title + body), comment/reply, add friends, and
see a feed of your own and your friends' posts. Backend: Node.js / Express /
TypeScript with PostgreSQL via Prisma. Frontend: Angular 20 (standalone
components). Auth is JWT + bcrypt with optional Google Sign-In.

## Structure

```
posts-app/
  backend/   # Express API (Prisma + PostgreSQL)
  frontend/  # Angular app
```

## Prerequisites

- Node.js + pnpm
- A reachable PostgreSQL instance. The included `docker-compose.yml` starts one
  for local dev (postgres:16 on :5432, `posts_app` / `postgres:postgres`).

## Run the database (local dev)

```bash
docker compose up -d   # postgres on :5432
```

## Run the backend

```bash
cd backend
pnpm install
# Set DATABASE_URL (and ideally JWT_SECRET) in backend/.env — see below.
pnpm prisma:migrate    # create/apply the schema
pnpm dev               # http://localhost:3000
```

### Backend environment (`backend/.env`, git-ignored)

- `DATABASE_URL` — **required** PostgreSQL connection string used by Prisma, e.g.
  `postgresql://postgres:postgres@localhost:5432/posts_app?schema=public`.
- `JWT_SECRET` — token signing secret. Falls back to an insecure dev value with
  a warning; **required in production** (the app throws on startup without it
  when `NODE_ENV=production`).
- `GOOGLE_CLIENT_ID` — must match the frontend `environment.googleClientId` for
  Google Sign-In.
- `CORS_ORIGIN` — comma-separated list of allowed frontend origins. Defaults to
  `http://localhost:4200` for local dev; set your real origin in production.
- `PORT` — defaults to 3000.

Security middleware is on by default: `helmet` security headers, a 100kb JSON
body cap, and a rate limiter on the auth routes (10 requests/IP/15min).

## Run the frontend

```bash
cd frontend
pnpm install
pnpm start       # http://localhost:4200
```

Make sure the backend is running first — the frontend calls
`http://localhost:3000/api` (see `frontend/src/environments/environment.ts`).

## Tests

```bash
cd backend && pnpm test   # Jest (data-layer unit tests)
```

## API

All routes are under `/api`. Post, comment, friend, presence, and notification
routes require a `Authorization: Bearer <token>` header. The full contract lives
in [`CLAUDE.md`](./CLAUDE.md). A summary of the core post routes:

| Method | Endpoint       | Auth | Body              | Notes                                  |
| ------ | -------------- | ---- | ----------------- | -------------------------------------- |
| GET    | /api/posts     | ✅   | — (query params)  | paginated feed of own + friends' posts |
| GET    | /api/posts/:id | ✅   | —                 | owner-scoped; 404 if not yours         |
| POST   | /api/posts     | ✅   | `{ title, body }` | 201 / 400 on invalid                   |
| PUT    | /api/posts/:id | ✅   | `{ title, body }` | owner-scoped; 200 / 400 / 404          |
| DELETE | /api/posts/:id | ✅   | —                 | owner-scoped; 204 / 404                |

Auth lives under `/api/auth` (`/signup`, `/login`, `/google`, `/me`). Comments,
friends, presence, and notifications are documented in `CLAUDE.md`.

## Validation rules

- `title`: required, min 3 chars (after trimming)
- `body`: required, min 10 chars (after trimming)

Applied on both client (Angular reactive form) and server
(`validatePost` middleware) — server is the source of truth, client is UX.

## Quick test

```bash
# Sign up to get a token
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"password123"}'

# Use the returned token for authenticated calls
curl http://localhost:3000/api/posts \
  -H "Authorization: Bearer <TOKEN>"
```
