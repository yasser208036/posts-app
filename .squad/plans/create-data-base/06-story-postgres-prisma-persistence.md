# Story 06 — User & Posts persistence on PostgreSQL via Prisma (one-to-many, owner-scoped)

## Prerequisites

- [Story 05 completed](../posts/05-story-authentication.md): the auth layer (`/api/auth/*`, JWT, `requireAuth`, `req.userId`) this story builds directly on. Every ownership check in this story reads `req.userId` set by `backend/src/middleware/requireAuth.ts` (line 26).
- **New backend dependencies are required and in scope.** `CLAUDE.md`'s "Don't add a database … unless asked" rule is **explicitly overridden** by this story's acceptance criteria ("System must use PostgreSQL … Prisma ORM … Data must be persisted (not in-memory)"). Add exactly the packages in **Backend Task 1** — nothing more.
- **A running PostgreSQL instance is required** at the URL given by the new `DATABASE_URL` env var. The executor must have Postgres reachable (local install, Docker, or hosted) before running migrations. State the connection string used; do not commit it.
- **Coordinate the shared contract — two breaking changes:**
  - The `data.ts` / `users.data.ts` module functions become **async** (return `Promise<…>`). Every controller that calls them must `await`. See **Backend Task 5–6**.
  - `GET /api/posts` and `GET /api/posts/:id` **stop being public** — they now require `requireAuth` and return only the caller's own posts (acceptance criterion "View only their posts"). This changes the API Contract table in `CLAUDE.md`.

---

## Story Goal

Replace the two in-memory stores (`backend/src/data.ts` posts array, `backend/src/users.data.ts` users array) with a PostgreSQL database accessed through Prisma, so users and posts survive a backend restart and every post belongs to exactly one user.

1. **Persistent users** — signup/login/google store and read users from Postgres via Prisma; passwords stay hashed (unchanged hashing from Story 05).
2. **Persistent posts** — create/read/update/delete posts hit Postgres.
3. **One-to-many ownership** — each `Post` has a required `userId` foreign key to `User.id`; one user has many posts. New posts are stamped with `req.userId`.
4. **Owner-scoped reads and writes** — a user sees, edits, and deletes **only their own** posts. Accessing another user's post returns 404 (not 403 — do not leak existence).
5. **Timestamps preserved** — `createdAt` / `updatedAt` remain ISO-8601 strings on the wire; Prisma manages them (`@default(now())`, `@updatedAt`).
6. **Local-time date filtering preserved** — the existing `startDate`/`endDate`/`date` filter semantics (local-time inclusive bounds) are kept, now expressed as a Prisma `where` clause.

**Not in scope:** persisting across schema changes without migrations, connection pooling tuning, seeding production data, soft deletes, sharing/permissions beyond single-owner, admin/global post views, changing the auth flow itself, or any frontend redesign. The seed of 50 mock posts (`initialPosts.ts`) is **removed** — see **Migration / Rollback**.

---

## Product rules (from story)

| Behaviour | Current (Story 05) | New (this story) |
|---|---|---|
| Data store | Two in-memory arrays, reset on restart | **PostgreSQL via Prisma**, persisted |
| Post reads (`GET /`, `GET /:id`) | Public, all posts | **Require `requireAuth`; only caller's own posts** |
| Post writes (`POST/PUT/DELETE`) | Auth required, any post | Auth required, **only caller's own post** (else 404) |
| Post ↔ User link | None | **Required `userId` FK; one user → many posts** |
| Cross-user access | N/A (no scoping) | **404** — never reveal another user's post exists |
| Mock seed posts | 50 seeded on boot | **Removed** — DB starts empty |

---

## Context — Read These Files First

1. `backend/src/data.ts` — **read whole (82 lines)**. This entire module is rewritten to call Prisma. Note `getPaginatedPosts` (lines 8–50) local-time bound construction (lines 14–32) and the `filtered.slice` pagination (lines 46–48) — reproduce the same semantics as a Prisma `where` + `skip`/`take`. Note `createPost` (55–66), `updatePost` (68–75), `deletePost` (77–81).
2. `backend/src/users.data.ts` — **read whole (36 lines)**. Rewritten to call Prisma. Keep the exact function names `findUserByEmail`, `findUserById`, `createUser`, `toPublicUser` and the email trim+lowercase rule (lines 8, 22).
3. `backend/src/types.ts` — **lines 1–36**. `Post` (1–7) gets a new `userId: string` field. `PostFilters` (21–25) and `User` (29–36) are unchanged in shape but now describe Prisma-mapped rows.
4. `backend/src/controllers/posts.controller.ts` — **read whole (77 lines)**. Every handler becomes `async`/`await`. `createPost` (47–55) must pass `req.userId`. `listPosts` (4–35), `getPost` (37–45), `updatePost` (57–66), `removePost` (68–76) must scope by `req.userId`.
5. `backend/src/controllers/auth.controller.ts` — **read whole (117 lines)**. `signup` (21–45), `login` (47–65), `googleLogin` (67–104), `me` (106–116) call the `users.*` functions that are now async — add `await`.
6. `backend/src/routes/posts.routes.ts` — **lines 14–18**. `router.get("/", …)` (14) and `router.get("/:id", …)` (15) gain `requireAuth`. `requireAuth` is already imported (line 10).
7. `backend/src/middleware/requireAuth.ts` — **lines 22–27**. `findUserById(payload.sub)` (line 23) is now async — this call must be `await`ed and the function made `async`.
8. `backend/src/app.ts` — **lines 1–18**. No route wiring change; only relevant if the executor adds a Prisma disconnect on shutdown (optional, see Edge Cases).
9. `backend/src/server.ts` — **lines 1–8**. Startup; optional graceful `prisma.$disconnect()` hook can live here.
10. `backend/package.json` — **deps block lines 10–16, devDeps 17–25, scripts 5–9**. Add Prisma deps and a `postinstall`/`prisma generate` note.
11. `backend/tsconfig.json` — `rootDir: "src"`, `outDir: "dist"`, `strict: true`. The generated Prisma client lives in `node_modules/@prisma/client` (default), so no `rootDir` conflict.
12. `backend/src/initialPosts.ts` — **read whole (15 lines)**. Its only consumer is `data.ts` line 3/6 — both removed. Delete this file (see Migration).
13. `frontend/src/app/models/post.model.ts` — **lines 1–7**. Add optional `userId?: string` to keep the model in sync (posts now carry an owner).
14. `frontend/src/app/services/post.service.ts` — **read whole (48 lines)**. No change needed: the `authInterceptor` (Story 05) already attaches the bearer token to every request, so the now-protected `GET` calls carry auth automatically. State this explicitly.
15. [`../posts/05-story-authentication.md`](../posts/05-story-authentication.md) — precedent for adding scoped backend deps and mirroring the `data.ts` module pattern. This story follows the same "keep function names, swap the storage" approach.

---

## Backend Tasks

### 1 — Add Prisma dependencies

**File: `backend/package.json`**

Add to `dependencies` (pinned, exact — do not use look-alike names):

```json
"@prisma/client": "5.22.0"
```

Add to `devDependencies`:

```json
"prisma": "5.22.0"
```

Add a `prisma` script and a `postinstall` to the `scripts` block so the client is generated after install and on fresh clones:

```json
"prisma:generate": "prisma generate",
"prisma:migrate": "prisma migrate dev",
"postinstall": "prisma generate"
```

Run `cd backend && pnpm install`.

---

### 2 — Prisma schema

**Create file: `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String?  // null for google-only accounts
  provider     String   // "local" | "google"
  createdAt    DateTime @default(now())
  posts        Post[]
}

model Post {
  id        String   @id @default(uuid())
  title     String
  body      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
}
```

- **`email @unique`** enforces the "one account per email" rule previously implied by `findUserByEmail`.
- **`onDelete: Cascade`** — deleting a user removes their posts (matches one-to-many ownership; documents intent even though user deletion is not an endpoint yet).
- **`@@index([userId])`** and **`@@index([createdAt])`** back the owner-scoped, date-filtered pagination query in Task 5.

---

### 3 — Environment + `.env`

**Create file: `backend/.env`** (git-ignored — verify `.env` is covered; `.gitignore` currently lists `node_modules` and `dist` only, so **add `.env` to `backend/.gitignore` or root `.gitignore`** in this task):

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/posts_app?schema=public"
```

**File: `.gitignore`** (repo root) — add `.env` above the squad-kit managed block so the DB URL is never committed. Do **not** touch the `# Managed by squad-kit` block.

Update `CLAUDE.md`'s "Required environment (backend)" list to add `DATABASE_URL` (**documentation only — still allowed; it is not app source**).

---

### 4 — Prisma client singleton

**Create file: `backend/src/prisma.ts`**

```ts
import { PrismaClient } from "@prisma/client";

// Single shared client for the process. ts-node-dev --respawn creates a fresh
// process on reload, so no global-caching hack is needed for dev.
export const prisma = new PrismaClient();
```

---

### 5 — Rewrite the posts data layer (owner-scoped, async)

**File: `backend/src/data.ts`** — replace the whole file. Remove the `initialPosts` import (line 3) and the in-memory array (line 6).

- Keep the exact local-time bound construction from lines 14–32 (build `from`/`to` `Date` objects the same way).
- All functions take `userId` and become `async`.

```ts
import { prisma } from "./prisma";
import { Post, PostInput, PostFilters } from "./types";

// Prisma returns Date for createdAt/updatedAt; the API contract is ISO strings.
function toPost(row: {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}): Post {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId,
  };
}

export const getPaginatedPosts = async (
  userId: string,
  page: number,
  limit: number,
  filters: PostFilters = {},
): Promise<{ data: Post[]; total: number }> => {
  const term = filters.title?.trim();

  // Local-time aware inclusive bounds — identical semantics to the old in-memory code.
  const from = filters.startDate
    ? (() => {
        const [y, m, d] = filters.startDate.split("-").map((v) => Number(v));
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
          return undefined;
        return new Date(y, m - 1, d, 0, 0, 0, 0);
      })()
    : undefined;
  const to = filters.endDate
    ? (() => {
        const [y, m, d] = filters.endDate.split("-").map((v) => Number(v));
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
          return undefined;
        return new Date(y, m - 1, d, 23, 59, 59, 999);
      })()
    : undefined;

  const where: any = { userId };
  if (term) where.title = { contains: term, mode: "insensitive" };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.post.count({ where }),
  ]);

  return { data: rows.map(toPost), total };
};

export const getPostById = async (
  userId: string,
  id: string,
): Promise<Post | undefined> => {
  const row = await prisma.post.findFirst({ where: { id, userId } });
  return row ? toPost(row) : undefined;
};

export const createPost = async (
  userId: string,
  input: PostInput,
): Promise<Post> => {
  const row = await prisma.post.create({
    data: { title: input.title, body: input.body, userId },
  });
  return toPost(row);
};

export const updatePost = async (
  userId: string,
  id: string,
  input: PostInput,
): Promise<Post | undefined> => {
  // Scope to owner: updateMany returns count, so we can tell "not mine" from "updated".
  const result = await prisma.post.updateMany({
    where: { id, userId },
    data: { title: input.title, body: input.body },
  });
  if (result.count === 0) return undefined;
  return getPostById(userId, id);
};

export const deletePost = async (
  userId: string,
  id: string,
): Promise<boolean> => {
  const result = await prisma.post.deleteMany({ where: { id, userId } });
  return result.count > 0;
};
```

> **Why `updateMany`/`deleteMany`:** Prisma's `update`/`delete` by unique `id` cannot also filter by `userId` in the same call and throw if the row is absent. `updateMany`/`deleteMany` accept the compound `where: { id, userId }` and return a `count`, giving clean "not found or not yours → 404" behaviour without a separate ownership read.

---

### 6 — Rewrite the users data layer (async)

**File: `backend/src/users.data.ts`** — replace the whole file. Keep the four exported names and the email trim+lowercase rule.

```ts
import { prisma } from "./prisma";
import { AuthProvider, PublicUser, User } from "./types";

export const findUserByEmail = async (
  email: string,
): Promise<User | null> =>
  prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  }) as Promise<User | null>;

export const findUserById = async (id: string): Promise<User | null> =>
  prisma.user.findUnique({ where: { id } }) as Promise<User | null>;

export const createUser = async (input: {
  name: string;
  email: string;
  passwordHash: string | null;
  provider: AuthProvider;
}): Promise<User> =>
  prisma.user.create({
    data: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      provider: input.provider,
    },
  }) as Promise<User>;

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
});
```

> **Note the `User` cast:** Prisma's generated `User` has `createdAt: Date` while `backend/src/types.ts` `User.createdAt` is `string`. These functions are only consumed by the auth controller (which reads `id`/`name`/`email`/`passwordHash`/`provider`, never `createdAt`), so the `as Promise<User>` cast is safe. **Do not** widen `types.ts` `User.createdAt` — leave it as documented.

---

### 7 — Make `requireAuth` await the user lookup

**File: `backend/src/middleware/requireAuth.ts`** — line 13 signature → `async`, line 23 → `await`:

```ts
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // …unchanged header parsing…
  try {
    const payload = verifyToken(token);
    if (!(await findUserById(payload.sub))) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
```

---

### 8 — Update the posts controller (async + scope by `req.userId`)

**File: `backend/src/controllers/posts.controller.ts`** — make every handler `async` and pass `req.userId`. `req.userId` is guaranteed set because all five routes now sit behind `requireAuth` (Task 9).

- **`listPosts`** (4–35): `const { data, total } = await db.getPaginatedPosts(req.userId!, page, limit, { title, startDate, endDate });`
- **`getPost`** (37–45): `const post = await db.getPostById(req.userId!, req.params.id);` — 404 unchanged.
- **`createPost`** (47–55): `const post = await db.createPost(req.userId!, { title, body });`
- **`updatePost`** (57–66): `const updated = await db.updatePost(req.userId!, req.params.id, { title, body });` — 404 when `undefined` (covers "not mine").
- **`removePost`** (68–76): `const deleted = await db.deletePost(req.userId!, req.params.id);` — 404 when `false`.

Keep the existing `try/catch` → `next(err)` in every handler; Prisma rejections propagate to `errorHandler` → 500.

---

### 9 — Protect the read routes

**File: `backend/src/routes/posts.routes.ts`** — add `requireAuth` to the two GET routes (import already present, line 10):

```ts
router.get("/", requireAuth, listPosts);
router.get("/:id", requireAuth, getPost);
router.post("/", requireAuth, validatePost, createPost);
router.put("/:id", requireAuth, validatePost, updatePost);
router.delete("/:id", requireAuth, removePost);
```

---

### 10 — Update the auth controller for async data calls

**File: `backend/src/controllers/auth.controller.ts`** — add `await` at every `users.*` call:

- `signup` (25): `const existing = await users.findUserByEmail(email);`; (34): `const user = await users.createUser({ … });`
- `login` (51): `const user = await users.findUserByEmail(email);`
- `googleLogin` (90): `let user = await users.findUserByEmail(payload.email);`; (92): `user = await users.createUser({ … });`
- `me` (108): `const user = req.userId ? await users.findUserById(req.userId) : null;` — adjust the truthiness check (now `null`, not `undefined`).

No status-code or response-shape changes.

---

### 11 — Add `userId` to the `Post` type

**File: `backend/src/types.ts`** — add to the `Post` interface (after line 6):

```ts
export interface Post {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  userId: string; // owner (FK to User.id)
}
```

---

## Frontend Tasks

### 1 — Sync the `Post` model

**File: `frontend/src/app/models/post.model.ts`** — add optional `userId?: string` after line 6 (`updatedAt?`). Optional so existing form/create code (`PostInput` has no `userId`) stays valid.

### 2 — No service or component changes required

**File: `frontend/src/app/services/post.service.ts`** — **No changes required.** The `authInterceptor` from Story 05 attaches the bearer token to every request, so the newly-protected `GET /posts` and `GET /posts/:id` carry auth automatically. The list route `''` is already behind `authGuard`, so an unauthenticated user never reaches the fetch. State this explicitly in the PR: the "view only their posts" behaviour is enforced entirely server-side.

> **Regression to watch:** any user who was signed in before this change still holds a valid 7-day JWT. After deploy they will correctly see only *their* posts (which is none, since the DB starts empty and old in-memory posts had no owner). This is expected — see Migration.

---

## Edge Cases & Failure Modes

- **Cross-user post access** — user A requests/edits/deletes user B's post id. Trigger: valid token for A, id belonging to B. Expected: **404** `{ message: "Post not found" }`, never 403. Enforced by the `where: { id, userId }` scoping in `getPostById`/`updatePost`/`deletePost` (`backend/src/data.ts`, Task 5).
- **`DATABASE_URL` missing/unreachable** — Trigger: env unset or Postgres down. Expected: Prisma throws on the first query; `errorHandler` (`backend/src/middleware/errorHandler.ts` line 8) returns **500** `{ message: "Internal server error" }` and logs. Document that a missing DB is a hard failure, unlike the old in-memory store.
- **Duplicate email at DB level** — Trigger: two concurrent signups with the same email pass the `findUserByEmail` check, then both `createUser`. Expected: the Postgres `@unique` constraint (schema Task 2) makes the second `create` throw `P2002`; it currently surfaces as **500**. **Mark as known limitation** — the app-level 409 in `auth.controller.ts` (lines 26–31) still handles the common non-race case; a P2002→409 mapping is a follow-up, not this story.
- **Invalid date filter** — Trigger: `startDate=not-a-date`. Expected: `Number()` yields `NaN`, the bound is `undefined`, and that side of the range is simply omitted (matches old behaviour of ignoring the bad bound). No crash. Enforced in `getPaginatedPosts` bound builders (Task 5).
- **Case-insensitive title search** — Trigger: `title=post`. Expected: matches "Post", "POST". Enforced by `mode: "insensitive"` on the Prisma `contains` filter (Task 5). Confirm the column collation supports it (default Postgres text + Prisma `insensitive` uses `ILIKE`).
- **Pagination past the end** — Trigger: `page=999` with 3 posts. Expected: `data: []`, `total: 3`, `totalPages` computed by the controller (unchanged, `Math.ceil(total/limit)`). `skip` beyond the row count returns empty, no error.
- **Old JWT after migration** — Trigger: token issued before this deploy. Expected: still valid (same `JWT_SECRET`); `requireAuth` `findUserById` succeeds only if that user row exists. Because users were in-memory before and are now empty in Postgres, **all pre-existing tokens fail `findUserById` → 401**, forcing re-signup. Expected and acceptable for a dev app.
- **Post-delete cascade** — Trigger: (future) deleting a user. Expected: their posts are removed via `onDelete: Cascade`. No user-delete endpoint exists yet; the rule is declared for correctness.

---

## Test Plan

There is **no test framework configured** (`backend/package.json` has no `test` script; `CLAUDE.md`: "no test suite or linter"). Do **not** introduce one in this story. Verification is by build + manual API exercise (below). Record these manual checks in the PR description:

1. **Migration applies** — `pnpm prisma migrate dev --name init` creates `User` + `Post` tables. Inspect with `pnpm prisma studio` or `psql \dt`.
2. **Signup persists** — `POST /api/auth/signup`, restart backend, `POST /api/auth/login` with the same creds succeeds (proves users survive restart — the core acceptance criterion).
3. **Post ownership** — create a post as user A, restart backend, `GET /api/posts` as A returns it (persistence); `GET /api/posts` as user B returns `{ data: [], total: 0 }` (scoping).
4. **Cross-user 404** — user B does `GET /api/posts/<A's id>` → 404; `PUT`/`DELETE` same id → 404.
5. **Unauth read blocked** — `GET /api/posts` with no `Authorization` header → 401 (new behaviour).
6. **Filters** — `GET /api/posts?title=…&startDate=…&endDate=…` returns the same shape and honours local-time bounds as before Story 04.

---

## Migration / Rollback

- **Create the initial migration:** `cd backend && pnpm prisma migrate dev --name init`. This creates `backend/prisma/migrations/` (commit it) and applies the schema to the DB pointed at by `DATABASE_URL`.
- **Remove the seed:** delete `backend/src/initialPosts.ts` and its imports/usages in `backend/src/data.ts` (old lines 3, 6). The DB starts **empty** — the 50 mock posts are gone by design (they had no owner and can't be scoped). Note this in the PR; it changes the first-run experience (`CLAUDE.md` "In-memory data resets / reseeds from initialPosts.ts" becomes obsolete — update that gotcha).
- **Half-applied state:** if `migrate dev` fails midway, the schema is transactional per migration — rerun after fixing `DATABASE_URL`. If the generated client is stale after editing `schema.prisma`, run `pnpm prisma generate`.
- **Rollback:** to revert to Story 05, `git revert` this change set and drop the created tables (`DROP TABLE "Post"; DROP TABLE "User";`) or drop the database. The in-memory stores return automatically once the Prisma-backed `data.ts`/`users.data.ts` are reverted.

---

## Verification Steps

1. **Prisma client generates:** `cd backend && pnpm install` then `pnpm prisma generate` — no errors, `@prisma/client` types available.
2. **Migration applies:** `cd backend && pnpm prisma migrate dev --name init` — `User` and `Post` tables created, migration committed under `backend/prisma/migrations/`.
3. **Backend builds:** `cd backend && pnpm build` (`tsc`) — no type errors from the now-`async` data/controller/middleware signatures.
4. **Backend runs:** `cd backend && pnpm dev` — starts on `:3000` with no runtime error; requires a reachable `DATABASE_URL`.
5. **Frontend builds:** `cd frontend && pnpm build` (`ng build`) — no errors after the `post.model.ts` field add.
6. **Regression (manual):** run Test Plan steps 2–6 against the running app — signup survives restart, posts are owner-scoped, cross-user access is 404, unauth read is 401, filters still work.

---

## Done Criteria

- [ ] PostgreSQL + Prisma added; `backend/prisma/schema.prisma` defines `User` and `Post` with a required `userId` FK (one user → many posts).
- [ ] `backend/src/data.ts` and `backend/src/users.data.ts` read/write via Prisma; no in-memory arrays remain; `initialPosts.ts` deleted.
- [ ] Users persist across a backend restart (signup, restart, login succeeds).
- [ ] Posts persist across a backend restart and each belongs to exactly one user (`userId`).
- [ ] A user can create/update/delete/view **only their own** posts; other users' posts return 404.
- [ ] `GET /api/posts` and `GET /api/posts/:id` require auth (401 without a valid token).
- [ ] Passwords are still hashed (Story 05 hashing unchanged); `passwordHash` never returned.
- [ ] `createdAt`/`updatedAt` remain ISO strings on the wire; local-time date filtering unchanged.
- [ ] `DATABASE_URL` documented in `CLAUDE.md`; `.env` git-ignored.
- [ ] `backend/tsc` and `frontend/ng build` both pass.
- [ ] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before implementing.**
