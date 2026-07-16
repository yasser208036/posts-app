# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Posts App — Working Guide

## Stack

| Layer    | Tech                                                        | Port  |
|----------|-------------------------------------------------------------|-------|
| Backend  | Node.js + Express 4 + TypeScript, in-memory data (no DB)    | :3000 |
| Frontend | Angular 20 (standalone components, zone.js change detection) | :4200 |
| Auth     | JWT (7d) + bcryptjs, Google Sign-In (google-auth-library)   |       |
| Styling  | Tailwind CSS v4 (`@tailwindcss/postcss`), no SCSS           |       |
| Package manager | pnpm (both sides)                                    |       |

## Commands

```bash
# Backend
cd backend && pnpm install && pnpm dev     # ts-node-dev → :3000
cd backend && pnpm build                   # tsc → dist/
cd backend && pnpm start                   # node dist/server.js

# Frontend
cd frontend && pnpm install && pnpm start  # ng serve → :4200
cd frontend && pnpm build                  # ng build
```

There is no test suite or linter configured on either side. Verify changes by
building (`tsc` / `ng build`) and exercising the running app.

### Required environment (backend)

Auth reads these from `process.env` with insecure dev fallbacks — set them for
anything real:

- `JWT_SECRET` — token signing secret (falls back to `dev-only-insecure-secret`).
- `GOOGLE_CLIENT_ID` — must match the frontend `environment.googleClientId` for
  Google Sign-In to verify tokens.
- `PORT` — defaults to 3000.

## Architecture

### Backend (`backend/src`)

Request flow: `server.ts` → `app.ts` (mounts `/api/auth` and `/api/posts`, then
`notFoundHandler` + `errorHandler`) → route → middleware → thin controller → data module.

- **Two in-memory stores, both reset on restart:** `data.ts` (posts, seeded from
  `initialPosts.ts`) and `users.data.ts` (users, starts empty). No database.
- **Controllers stay thin** — they call the data modules. Post validation lives
  only in `middleware/validatePost.ts`; auth validation in `middleware/validateAuth.ts`.
- **Auth is JWT bearer tokens.** `auth/jwt.ts` signs/verifies, `auth/password.ts`
  hashes/compares with bcrypt. `middleware/requireAuth.ts` reads
  `Authorization: Bearer <token>`, verifies it, confirms the user still exists,
  and sets `req.userId` (typed via a global Express augmentation in that file).
- **Post mutations require auth; reads are public.** In `posts.routes.ts`,
  `POST`/`PUT`/`DELETE` are gated by `requireAuth`; `GET /` and `GET /:id` are not.
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

| Method | Path   | Auth | Body            | Success             | Error                            |
|--------|--------|------|-----------------|---------------------|----------------------------------|
| GET    | /      | —    | — (query below) | 200 `Paginated<Post>` | 500                            |
| GET    | /:id   | —    | —               | 200 `Post`          | 404 `{ message }`                |
| POST   | /      | ✅   | `{ title, body }` | 201 `Post`        | 400 `{ message, errors }` · 401 · 500 |
| PUT    | /:id   | ✅   | `{ title, body }` | 200 `Post`        | 400 · 401 · 404 · 500            |
| DELETE | /:id   | ✅   | —               | 204 (no body)       | 401 · 404 · 500                  |

`GET /` query params: `page` (default 1, min 1), `limit` (default 10, min 1,
max 100), `title` (substring, case-insensitive), `startDate` / `endDate`
(`YYYY-MM-DD`, inclusive, **local-time** bounds), or `date` (shorthand that sets
both start and end to the same day).

### Auth — `/api/auth`

| Method | Path    | Auth | Body                        | Success           | Error                          |
|--------|---------|------|-----------------------------|-------------------|--------------------------------|
| POST   | /signup | —    | `{ name, email, password }` | 201 `AuthResponse` | 400 · 409 `{ message, errors }` |
| POST   | /login  | —    | `{ email, password }`       | 200 `AuthResponse` | 400 · 401 `{ message }`        |
| POST   | /google | —    | `{ credential }`            | 200 `AuthResponse` | 400 · 401 `{ message }`        |
| GET    | /me     | ✅   | —                           | 200 `PublicUser`   | 401 `{ message }`              |

### Response shapes

```ts
// Post
{ id, title, body, createdAt, updatedAt }   // all string

// Paginated<Post> — GET /posts envelope
{ data: Post[], total: number, page: number, totalPages: number }

// AuthResponse
{ token: string, user: { id, name, email } }

// Validation error (400) — signup 409 uses the same shape for duplicate email
{ message: "Validation failed", errors: { title?, body?, name?, email?, password? } }

// Not found (404): { message: "Post not found" }  // "Route not found" for unknown paths
```

## Validation Rules (keep in sync!)

| Field    | Rule                          | Backend                     | Frontend                          |
|----------|-------------------------------|-----------------------------|-----------------------------------|
| title    | required, ≥3 chars (trimmed)  | `middleware/validatePost.ts` | `post-form.component.ts` Validators |
| body     | required, ≥10 chars (trimmed) | `middleware/validatePost.ts` | `post-form.component.ts` Validators |
| name     | required, ≥2 chars (trimmed)  | `middleware/validateAuth.ts` | signup form                       |
| email    | required, valid format        | `middleware/validateAuth.ts` | login/signup forms                |
| password | required, ≥8 chars            | `middleware/validateAuth.ts` | login/signup forms                |

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
- **In-memory data resets on backend restart.** Posts reseed from `initialPosts.ts`;
  users start empty (you must sign up again after every restart).
- **CORS is wide open** (`cors()` no config) — local dev only.
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
