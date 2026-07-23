# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Posts App — Working Guide

## Stack

| Layer           | Tech                                                         | Port  |
| --------------- | ------------------------------------------------------------ | ----- |
| Backend         | Node.js + Express 4 + TypeScript, PostgreSQL via Prisma      | :3000 |
| Frontend        | Angular 20 (standalone components, zone.js change detection) | :4200 |
| Auth            | JWT (7d) + bcryptjs, Google Sign-In (google-auth-library)    |       |
| Styling         | Tailwind CSS v4 (`@tailwindcss/postcss`), no SCSS            |       |
| Package manager | pnpm (both sides)                                            |       |

## Commands

```bash
# Postgres (from repo root) — starts the DB that DATABASE_URL points to
docker compose up -d                        # postgres:16 on :5432 (posts_app / postgres:postgres)

# Backend
cd backend && pnpm install && pnpm dev     # ts-node-dev → :3000
cd backend && pnpm build                   # tsc → dist/
cd backend && pnpm start                   # node dist/server.js
cd backend && pnpm prisma:migrate          # prisma migrate dev — create/apply schema
cd backend && pnpm prisma:generate         # regenerate Prisma client

# Frontend
cd frontend && pnpm install && pnpm start  # ng serve → :4200
cd frontend && pnpm build                  # ng build
```

The backend has a Jest unit-test suite for the data layer (`pnpm test` in
`backend/`); the frontend has no test suite. No linter is configured on either
side. Verify changes by running the tests, building (`tsc` / `ng build`), and
exercising the running app.

### Required environment (backend)

Auth reads these from `process.env` with insecure dev fallbacks — set them for
anything real:

- `DATABASE_URL` — PostgreSQL connection string used by Prisma. Required; a
  missing or unreachable DB is a hard failure (queries throw → 500). Set in
  `backend/.env` (git-ignored). Example:
  `postgresql://postgres:postgres@localhost:5432/posts_app?schema=public`.
- `JWT_SECRET` — token signing secret. Falls back to `dev-only-insecure-secret`
  in dev with a warning; **required in production** — `auth/jwt.ts` throws on
  startup if it is unset when `NODE_ENV=production`.

- `GOOGLE_CLIENT_ID` — must match the frontend `environment.googleClientId` for
  Google Sign-In to verify tokens.
- `PORT` — defaults to 3000.

## Architecture

### Backend (`backend/src`)

Request flow: `server.ts` → `app.ts` (mounts `/api/auth` and `/api/posts`, then
`notFoundHandler` + `errorHandler`) → route → middleware → thin controller → data module.

- **Two Prisma-backed data modules:** `data.ts` (posts) and `users.data.ts`
  (users), both reading/writing PostgreSQL via the shared client in `prisma.ts`.
  Data persists across restarts. Posts are owner-scoped by `userId`.
- **Controllers stay thin** — they call the data modules. Post validation lives
  only in `middleware/validatePost.ts`; auth validation in `middleware/validateAuth.ts`.
- **Auth is JWT bearer tokens.** `auth/jwt.ts` signs/verifies, `auth/password.ts`
  hashes/compares with bcrypt. `middleware/requireAuth.ts` reads
  `Authorization: Bearer <token>`, verifies it, confirms the user still exists,
  and sets `req.userId` (typed via a global Express augmentation in that file).
- **Post routes require auth; mutations are owner-scoped.** In `posts.routes.ts`,
  every route (`GET`/`POST`/`PUT`/`DELETE`) is gated by `requireAuth`. The **list**
  (`GET /`) returns the caller's own posts **and their accepted friends' posts**
  (each with `author`); `GET /:id`, `POST`, `PUT`, `DELETE` scope by `req.userId`,
  so a user only ever fetches-by-id/edits/deletes their own posts. Another user's
  post id on those returns **404** (never 403 — existence is not leaked).
- **Never leak `passwordHash`.** Return `PublicUser` (via `users.toPublicUser`),
  never the raw `User`. Emails are stored trimmed + lowercased.
- **Google accounts have `passwordHash: null`** and `provider: "google"`. Login
  rejects password auth against them (`!user.passwordHash` → 401).

### Frontend (`frontend/src/app`)

- **Standalone components only** (no NgModules). `app.config.ts` wires
  `provideRouter` + `provideHttpClient(withInterceptors([authInterceptor]))`.
- **Routes (`app.routes.ts`):** `''` → `PostListComponent` (guarded by
  `authGuard`), `login`, `signup`, `**` → redirect to `''`. There is **no**
  `new` or `edit/:id` route anymore — create/edit happen in a modal (see below).
- **Auth state** lives in `AuthService`: token + user persisted to
  `localStorage` (`posts_auth_token`, `posts_auth_user`), user exposed as
  `user$` (BehaviorSubject). `authInterceptor` attaches the bearer token to
  every request; `authGuard` redirects unauthenticated users to `/login`.
- **Create/edit is a modal, not a route.** The navbar "New Post" button calls
  `AppComponent.openNewPost()`, which navigates to `/` then fires
  `CreatePostTriggerService.open()`. `PostListComponent` subscribes to
  `createTrigger.trigger$` and opens `ModalComponent` wrapping `PostFormComponent`
  (reused for create and edit). This decoupling via a shared Subject is how the
  shell tells the list to open the form.
- **Search & filter** on the list: `searchTerm` + `startDate`/`endDate` feed a
  `Subject` debounced 500ms; on emit it resets to page 1 and refetches. Filters
  are passed to `PostService.getAll(page, limit, { title, startDate, endDate })`
  as query params.

## API Contract

Base URL: `http://localhost:3000/api`

### Posts — `/api/posts`

| Method | Path                     | Auth | Body                  | Success                   | Error                                       |
| ------ | ------------------------ | ---- | --------------------- | ------------------------- | ------------------------------------------- |
| GET    | /                        | ✅   | — (query below)       | 200 `Paginated<FeedPost>` | 401 · 500                                   |
| GET    | /:id                     | ✅   | —                     | 200 `Post`                | 401 · 404 `{ message }`                     |
| POST   | /                        | ✅   | `{ title, body }`     | 201 `Post`                | 400 `{ message, errors }` · 401 · 500       |
| PUT    | /:id                     | ✅   | `{ title, body }`     | 200 `Post`                | 400 · 401 · 404 · 500                       |
| DELETE | /:id                     | ✅   | —                     | 204 (no body)             | 401 · 404 · 500                             |
| GET    | /:id/comments            | ✅   | —                     | 200 `Comment[]`           | 401 · 404 · 500                             |
| POST   | /:id/comments            | ✅   | `{ body, parentId? }` | 201 `Comment`             | 400 `{ message, errors }` · 401 · 404 · 500 |
| PUT    | /:id/comments/:commentId | ✅   | `{ body }`            | 200 `Comment`             | 400 `{ message, errors }` · 401 · 404 · 500 |
| DELETE | /:id/comments/:commentId | ✅   | —                     | 204 (no body)             | 401 · 404 · 500                             |

`GET /` returns the caller's **own posts and their accepted friends' posts** in
one paginated response, newest first, each carrying `author: PublicUser`. The
list widens to friends; **create/edit/delete and `GET /:id` stay owner-scoped**
(a user only ever mutates their own posts — a friend's post id on `PUT`/`DELETE`
returns 404). Query params: `page` (default 1, min 1), `limit` (default 10, min 1,
max 100), `title` (substring, case-insensitive), `startDate` / `endDate`
(`YYYY-MM-DD`, inclusive, **local-time** bounds), or `date` (shorthand that sets
both start and end to the same day) — all applied across the own+friends union.

### Auth — `/api/auth`

| Method | Path    | Auth | Body                        | Success            | Error                           |
| ------ | ------- | ---- | --------------------------- | ------------------ | ------------------------------- |
| POST   | /signup | —    | `{ name, email, password }` | 201 `AuthResponse` | 400 · 409 `{ message, errors }` |
| POST   | /login  | —    | `{ email, password }`       | 200 `AuthResponse` | 400 · 401 `{ message }`         |
| POST   | /google | —    | `{ credential }`            | 200 `AuthResponse` | 400 · 401 `{ message }`         |
| GET    | /me     | ✅   | —                           | 200 `PublicUser`   | 401 `{ message }`               |

### Users — `/api/users`

| Method | Path | Auth | Body | Success                           | Error     |
| ------ | ---- | ---- | ---- | --------------------------------- | --------- |
| GET    | /    | ✅   | —    | 200 `(PublicUser & { online })[]` | 401 · 500 |

`GET /api/users` lists every user except the caller (for finding people to
friend). Each user carries a server-computed `online` boolean (`true` when
`lastSeenAt` is within a 60s freshness window).

### Presence — `/api/presence`

| Method | Path    | Auth | Body | Success       | Error     |
| ------ | ------- | ---- | ---- | ------------- | --------- |
| POST   | /ping   | ✅   | —    | 204 (no body) | 401 · 500 |
| POST   | /logout | ✅   | —    | 204 (no body) | 401 · 500 |

`POST /api/presence/ping` stamps the caller's `lastSeenAt = now()`. The frontend
sidebars ping every 30s; `online` is computed against a 60s window (2× the ping
interval, so one dropped ping doesn't flip a user offline).
`POST /api/presence/logout` clears the caller's `lastSeenAt` (sets it null) so
they immediately drop offline; the frontend fires it on logout (best-effort).

### Friends — `/api/friends`

| Method | Path                 | Auth | Body             | Success                      | Error                       |
| ------ | -------------------- | ---- | ---------------- | ---------------------------- | --------------------------- |
| GET    | /                    | ✅   | —                | 200 `PublicUser[]`           | 401 · 500                   |
| GET    | /requests            | ✅   | —                | 200 `FriendRequestDto[]`     | 401 · 500                   |
| GET    | /requests/count      | ✅   | —                | 200 `{ count: number }`      | 401 · 500                   |
| POST   | /requests            | ✅   | `{ receiverId }` | 201 `FriendRequest`          | 400 · 404 · 409 · 401 · 500 |
| POST   | /requests/:id/accept | ✅   | —                | 200 `{ status: "accepted" }` | 404 · 401 · 500             |
| POST   | /requests/:id/reject | ✅   | —                | 200 `{ status: "rejected" }` | 404 · 401 · 500             |

### Notifications — `/api/notifications`

| Method | Path                 | Auth | Body | Success                 | Error     |
| ------ | -------------------- | ---- | ---- | ----------------------- | --------- |
| GET    | /                    | ✅   | —    | 200 `NotificationDto[]` | 401 · 500 |
| DELETE | /comments/:commentId | ✅   | —    | 204 (no body)           | 401 · 500 |

`GET /api/notifications` returns a unified feed: pending friend requests plus
comment/reply notifications on the caller's posts/comments, newest first.
`DELETE /comments/:commentId` **dismisses** a comment/reply notification (records
it seen for the caller) so it stops surfacing — the frontend fires this when the
user opens a notification's target from the feed. Idempotent (unknown or
already-seen comment → still 204).

Comment routes live under `/api/posts` (above): a user may read/add comments on

a post they **own or a friend owns** — anything else returns **404** (existence
is not leaked). Comments carry `author: PublicUser`, `authorId`, and
`parentId` (nesting) and are ordered oldest→newest. `body` is required (≥1 char
after trimming). `POST /:id/comments` accepts an optional `parentId` to reply to
another comment; replies **nest to any depth** (the UI renders the thread
recursively). A `parentId` that is unknown or on another post is dropped to
top-level. **Edit and delete are author-scoped** —
`PUT`/`DELETE /:id/comments/:commentId` only affect a comment the caller
authored; anyone else's comment id returns **404**. Deleting a parent comment

cascades to its replies.

### Response shapes

```ts
// Post
{ id, title, body, createdAt, updatedAt }   // all string

// FeedPost — GET /posts list element carries the author
{ id, title, body, createdAt, updatedAt, userId, author: { id, name, email } }

// Paginated<FeedPost> — GET /posts envelope
{ data: FeedPost[], total: number, page: number, totalPages: number }

// Comment — GET/POST/PUT /posts/:id/comments — carries authorId + parentId (nesting)
{ id, body, createdAt, authorId, parentId: string | null, author: { id, name, email } }

// AuthResponse
{ token: string, user: { id, name, email } }

// Validation error (400) — signup 409 uses the same shape for duplicate email
{ message: "Validation failed", errors: { title?, body?, name?, email?, password? } }

// Not found (404): { message: "Post not found" }  // "Route not found" for unknown paths
```

## Validation Rules (keep in sync!)

| Field    | Rule                          | Backend                         | Frontend                              |
| -------- | ----------------------------- | ------------------------------- | ------------------------------------- |
| title    | required, ≥3 chars (trimmed)  | `middleware/validatePost.ts`    | `post-form.component.ts` Validators   |
| body     | required, ≥10 chars (trimmed) | `middleware/validatePost.ts`    | `post-form.component.ts` Validators   |
| name     | required, ≥2 chars (trimmed)  | `middleware/validateAuth.ts`    | signup form                           |
| email    | required, valid format        | `middleware/validateAuth.ts`    | login/signup forms                    |
| password | required, ≥8 chars            | `middleware/validateAuth.ts`    | login/signup forms                    |
| comment  | required, ≥1 char (trimmed)   | `middleware/validateComment.ts` | `post-list.component.ts` submit guard |

Length is measured **after trimming**, so whitespace-only input is rejected on
both client and server. **When changing validation, update both sides** and show
the server `errors` object next to the matching field.

## Conventions

- **TypeScript strict mode** on both sides.
- **Backend:** thin controllers; validation only in the `validate*` middleware;
  correct status codes (200/201/204/400/401/404/409/500) with `{ message, errors? }`.
- **Frontend:** standalone components only; reactive forms with `Validators`;
  every API call handles `loading` + `error` state; server 400 `errors` shown
  next to the matching field.
- **Styling is Tailwind v4 utility classes in templates.** Global CSS is
  `src/styles.css` (`@import "tailwindcss"` + `@theme` custom tokens like
  `--color-brand-*` and the Outfit font). No SCSS, no component stylesheets, no
  other CSS framework.

## Gotchas & Important Notes

- **zone.js polyfill is required.** `angular.json` needs `"polyfills": ["zone.js"]`.
  Without it the app renders blank (NG0908).
- **Data persists in PostgreSQL.** No seed data — the DB starts empty. Requires a
  reachable `DATABASE_URL`; run `pnpm prisma migrate dev` to create the schema.
  `GET /api/posts` requires auth and returns the caller's own posts plus their
  accepted friends' posts (401 without a valid token).
- **CORS is origin-restricted.** `app.ts` allows the origins in `CORS_ORIGIN`
  (comma-separated env var), defaulting to `http://localhost:4200` for dev.
- **Security middleware:** `helmet()` sets baseline security headers, and the
  unauthenticated auth routes (`/api/auth/login|signup|google`) are rate-limited
  to 10 requests/IP/15min via `middleware/rateLimit.ts`.
- **Request bodies are capped** at 100kb (`express.json({ limit })`).

- **Google Sign-In needs matching client IDs** on backend (`GOOGLE_CLIENT_ID`
  env) and frontend (`environment.googleClientId`), plus the GSI `<script>` in
  `index.html`.
- **Date filters use local time**, not UTC — `startDate`/`endDate` bounds are
  built with `new Date(y, m-1, d, ...)` in `data.ts`.

## When asked to change something

- Keep diffs minimal — don't restructure unrelated files.
- No new dependencies unless asked.
- After any backend route/validation change, verify the matching frontend
  form/service still matches the contract.
- Don't add a database or state-management library unless asked (auth already exists).

## Output style

- Code changes only, no restating unchanged files.
- Short summary of what changed, not a full re-explanation of the app.
