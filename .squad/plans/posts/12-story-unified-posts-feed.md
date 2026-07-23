# Story 12 — Unified posts feed: own + friends' posts on the main page

---

## Prerequisites

- [Story 10 completed](../users/10-story-friends-posts-and-comments.md): the `Comment` model, `friendIds` helper (`backend/src/friends.data.ts` lines 193–212), `getFriendsFeed`/`canCommentOnPost`/`addComment`/`listComments` in `backend/src/data.ts`, the `/api/feed` endpoint, and the standalone `FeedComponent` this story **merges into the main list**.
- [Story 07 completed](../users/07-story-friendship-domain-api.md): the `FriendRequest`/`accepted` relation that `friendIds` reads.
- [Story 06 completed](../create-data-base/06-story-postgres-prisma-persistence.md): the `Post` model, owner scoping, `toPost` mapper, and pagination semantics this story extends.
- **Edit/Delete stay owner-scoped.** `PUT`/`DELETE`/`GET /:id` on `/api/posts` remain scoped to `req.userId` — a user still edits/deletes only their **own** posts. Only the **list** (`GET /api/posts`) widens to include friends' posts.

---

## Story Goal

Collapse the two-surface model (own posts on `/`, friends' posts on `/feed`) into **one**:

1. **One list API** — `GET /api/posts` returns the caller's **own posts and their accepted friends' posts** in a single paginated response, each post carrying its `author`, newest first. No separate feed endpoint.
2. **One page** — the main page (`/`) renders that unified list. The **Friends' Posts page (`/feed`) is removed** — route, component, navbar link, and the `getFeed` service call all go.
3. **One card** — the feed-style card (author avatar + name, inline comments thread, add-comment form) becomes the card for **every** post on the main page. Edit/Delete actions appear **only on the caller's own posts** (`post.userId === currentUserId`); friends' posts are read-only but commentable.

**Not in scope:** changing comment permissions (`canCommentOnPost` unchanged — own or friend), editing/deleting comments, likes, notifications for comments, real-time push, changing search/date-filter behaviour (filters still apply to the unified list).

---

## Product rules (from story)

| Behaviour | Current | New |
|---|---|---|
| `GET /api/posts` list | Own posts only | **Own + accepted friends' posts, each with `author`** |
| `GET /api/feed` | Friends' posts, read-only | **Removed** (folded into `GET /api/posts`) |
| Main page `/` card | Title/body + Edit/Delete | **Author + title/body + comments thread; Edit/Delete only on own posts** |
| Friends' Posts page `/feed` | Separate route + component | **Removed** |
| `PUT`/`DELETE`/`GET /:id` | Owner-scoped | **Unchanged (owner-scoped)** |
| Comments (`/:id/comments`) | Own or friend's post | **Unchanged** |
| Search / date filters | Applied to own posts | **Applied to the unified own+friends set** |

---

## Context — Read These Files First

1. `backend/src/data.ts` — **read whole (197 lines)**. `getPaginatedPosts` (57–93) is the function to widen: its `where` (73) is `{ userId }`; it must become `{ userId: { in: [caller, ...friendIds] } }`, must `include` the author, and must return `FeedPost[]`. `getFriendsFeed` (138–161) is the precedent for the author `include` + `{ ...toPost(row), author: row.user }` mapping — **delete it** after folding its shape into `getPaginatedPosts`. `publicUserSelect` (13), `toPost` (18–27).
2. `backend/src/controllers/posts.controller.ts` — **read whole (100 lines)**. `listPosts` (4–44) parses `page`/`limit`/`title`/`date`/`startDate`/`endDate`; it must additionally resolve `friendIds(req.userId!)` and pass the id set to the data layer. Mirror the `friendIds` usage in `feed.controller.ts` (line 17).
3. `backend/src/controllers/feed.controller.ts` — **read whole (24 lines)**. Source of the `friendIds` + envelope pattern; **delete this file**.
4. `backend/src/routes/feed.routes.ts` — **read whole (9 lines)**; **delete this file**.
5. `backend/src/app.ts` — **lines 8 and 21**: the `feedRouter` import and `app.use("/api/feed", feedRouter)` mount; **remove both**.
6. `backend/src/types.ts` — **lines 22–26** (`PostFilters`), **lines 83–86** (`FeedPost`). `FeedPost` becomes the list element type; `PostFilters` is unchanged.
7. `backend/src/friends.data.ts` — **lines 193–212** (`friendIds`): returns accepted-friend ids, **excludes** the caller. The list widening does `[req.userId!, ...ids]`.
8. `backend/src/data.test.ts` — **read whole (138 lines)**. Uses a `prismaMock` with `post.findMany`/`post.count`/`comment.*`. Remove the `getFriendsFeed` describe block (71–94); add a `getPaginatedPosts` block asserting the union `where` and author mapping.
9. `frontend/src/app/components/feed/feed.component.ts` + `.html` — **read whole** (`.ts` 125 lines, `.html` 211 lines). The comment-thread state machine (`expanded`/`comments`/`commentDrafts`/`commentErrors`/`submitComment`/`toggleComments`/`loadComments`, `.ts` 23–110) and the author + comments card markup (`.html` 52–154) move into `PostListComponent`. **Delete both files** after porting.
10. `frontend/src/app/components/post-list/post-list.component.ts` + `.html` — **read whole** (`.ts` 160 lines, `.html` 359 lines). The list gains author display + the comment thread; Edit/Delete (`.html` 171–215) become conditional on ownership. Keep the filter bar (`.html` 22–63), pagination, and create/edit modals (`.html` 344–359).
11. `frontend/src/app/services/post.service.ts` — **read whole (76 lines)**. `getAll` (20–38) return type changes to `PaginatedResponse<FeedPost>`; **delete `getFeed`** (56–67); keep `getComments`/`addComment` (69–75).
12. `frontend/src/app/services/auth.service.ts` — **lines 15–19**: `user$` (`BehaviorSubject<AuthUser | null>`). `PostListComponent` subscribes to get the current user id for the ownership check.
13. `frontend/src/app/models/post.model.ts` — **read whole (43 lines)**. `FeedPost` (28–31) already carries `author`; `userId` is on `Post` (7, optional). The list binds to `FeedPost`.
14. `frontend/src/app/app.routes.ts` — **read whole (15 lines)**. Remove the `feed` route (9) and the `FeedComponent` import (3).
15. `frontend/src/app/app.component.ts` — **lines 76–83**: the `routerLink="/feed"` "Friends' Posts" navbar link; **remove it** and the now-unused imports if any.

---

## Backend Tasks

### 1 — Widen `getPaginatedPosts` to own + friends, carry author

**File: `backend/src/data.ts`** — change the signature and body of `getPaginatedPosts` (57–93) to accept the full id set and return `FeedPost[]`:

```ts
export const getPaginatedPosts = async (
  authorIds: string[],           // caller id + accepted-friend ids
  page: number,
  limit: number,
  filters: PostFilters = {},
): Promise<{ data: FeedPost[]; total: number }> => {
  const term = filters.title?.trim();
  const from = filters.startDate ? parseLocalDate(filters.startDate, "start") : undefined;
  const to = filters.endDate ? parseLocalDate(filters.endDate, "end") : undefined;

  const where: Prisma.PostWhereInput = { userId: { in: authorIds } };
  if (term) where.title = { contains: term, mode: "insensitive" };
  if (from || to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = from;
    if (to) createdAt.lte = to;
    where.createdAt = createdAt;
  }

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: publicUserSelect } },
    }),
    prisma.post.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({ ...toPost(row), author: row.user })),
    total,
  };
};
```

- Import `FeedPost` — it is already imported at the top of `data.ts` (line 6).
- **Delete `getFriendsFeed`** (138–161) — its behaviour is now a subset of `getPaginatedPosts`.

### 2 — `listPosts` resolves friends

**File: `backend/src/controllers/posts.controller.ts`** — in `listPosts` (4–44), import and call `friendIds`, then pass the union:

```ts
import { friendIds } from "../friends.data";
// …
const ids = await friendIds(req.userId!);
const { data, total } = await db.getPaginatedPosts(
  [req.userId!, ...ids],
  page,
  limit,
  { title, startDate, endDate },
);
```

Leave `getPost`/`createPost`/`updatePost`/`removePost` unchanged (still owner-scoped via `req.userId!`).

### 3 — Remove the feed endpoint

- **Delete file: `backend/src/controllers/feed.controller.ts`**.
- **Delete file: `backend/src/routes/feed.routes.ts`**.
- **File: `backend/src/app.ts`** — remove the `import feedRouter from "./routes/feed.routes";` (line 8) and the `app.use("/api/feed", feedRouter);` mount (line 21).

### 4 — Docs

**Update `CLAUDE.md`:**
- In the **Posts** contract table, note `GET /` now returns **own + friends' posts**, each carrying `author` (envelope becomes `Paginated<FeedPost>`).
- **Remove the entire `### Feed — /api/feed` section.**
- Update the "All post routes require auth and are owner-scoped" narrative: the **list** is own+friends; create/edit/delete/`GET :id` remain owner-scoped.

---

## Frontend Tasks

### 1 — Service

**File: `frontend/src/app/services/post.service.ts`**:
- Change `getAll` (20–38) return type to `Observable<PaginatedResponse<FeedPost>>` and its `this.http.get<PaginatedResponse<FeedPost>>(this.baseUrl, { params })`.
- **Delete `getFeed`** (56–67). Keep `getComments`/`addComment`.
- Drop the now-unused `FeedPost` re-export concerns — `FeedPost` stays imported (it is used by `getAll`).

### 2 — `PostListComponent` (`.ts`)

**File: `frontend/src/app/components/post-list/post-list.component.ts`** — merge the feed's comment state + ownership:

- Change `posts: Post[]` → `posts: FeedPost[]` (import `FeedPost`, `Comment` from `../../models/post.model`).
- Inject `AuthService`; subscribe to `user$` in `ngOnInit` to hold `currentUserId: string | null`, and add `isOwn(post: FeedPost): boolean { return !!this.currentUserId && post.userId === this.currentUserId; }`.
- Port the comment fields and methods **verbatim** from `feed.component.ts` (23–110): `expanded`, `comments`, `commentDrafts`, `commentErrors`, `commentsLoaded`, `submitting`, `toggleComments`, `loadComments`, `isSubmitting`, `submitComment`.
- Add `FormsModule` is already imported; add nothing new beyond `AuthService`.
- Keep `fetchPosts` as-is (it already reads `getAll(...)`); the response now has `author`.
- Ensure the `user$` subscription is added to `this.sub` so it is torn down in `ngOnDestroy`.

### 3 — `PostListComponent` (`.html`)

**File: `frontend/src/app/components/post-list/post-list.component.html`** — replace the post card (108–218) so each `article` renders:
- **Author row** (avatar initial + `post.author.name` + `· {{ post.createdAt | date:'yyyy-MM-dd HH:mm' }}`) — ported from `feed.component.html` 59–75.
- **Title + body** (existing 116–124, kept).
- **Edit/Delete buttons gated by ownership** — wrap the existing button group (171–215) in `*ngIf="isOwn(post)"` so friends' posts are read-only.
- **Comments toggle + thread + add-comment form** — ported from `feed.component.html` 82–152.
- Keep the filter bar (22–63), loading skeleton, error alert, pagination (220–269), empty states (271–341), and the two `app-modal` blocks (344–359) unchanged.
- Update the empty-state copy if desired to reflect "own + friends'" (e.g. keep "No posts yet" — acceptable; the create CTA still applies since the user can post).

### 4 — Remove the feed page

- **Delete file: `frontend/src/app/components/feed/feed.component.ts`**.
- **Delete file: `frontend/src/app/components/feed/feed.component.html`**.
- **File: `frontend/src/app/app.routes.ts`** — remove the `FeedComponent` import (3) and the `{ path: "feed", … }` route (9).
- **File: `frontend/src/app/app.component.ts`** — remove the `routerLink="/feed"` "Friends' Posts" `<a>` (76–83).

---

## Edge Cases & Failure Modes

- **No friends** — `friendIds` returns `[]`; the union is `[caller]`, so `getPaginatedPosts` returns only the caller's own posts (never empty of own posts, unlike the old `getFriendsFeed` early-return). Enforced by `[req.userId!, ...ids]` in `posts.controller.ts`.
- **Own posts must still appear** — `req.userId!` is always first in `authorIds`; a user with zero friends still sees their posts on `/`.
- **Duplicate ids** — `friendIds` excludes the caller (`friends.data.ts` 193–212), so `[caller, ...ids]` has no duplicate of self; friend ids are already de-duped via the `Set` in `friendIds`. `userId: { in: [...] }` tolerates any duplicates regardless.
- **Edit/Delete on a friend's post** — hidden in the template (`*ngIf="isOwn(post)"`); even if forced, `PUT`/`DELETE /api/posts/:id` are still owner-scoped server-side (`updatePost`/`deletePost` use `updateMany`/`deleteMany` with `{ id, userId }`) → 404. Existence not leaked.
- **Comment on a friend's post** — unchanged: `canCommentOnPost` allows own or friend, else 404 (`comments.controller.ts`).
- **Filters over the union** — `title`/`startDate`/`endDate` apply to the widened `where`, so search/date filter across own + friends' posts; `total`/`totalPages` reflect the filtered union.
- **`currentUserId` not yet loaded** — `isOwn` returns `false` until `user$` emits, so buttons hide briefly rather than mis-showing on a friend's post. `user$` is a `BehaviorSubject` seeded from `localStorage`, so it emits synchronously on subscribe.
- **Stale `/feed` bookmark** — the `**` wildcard route redirects unknown paths to `''`, so a bookmarked `/feed` lands on the main page after removal.
- **Author for a deleted user** — `Post.userId` FK is `onDelete: Cascade`, so a post cannot outlive its author; `post.author` is always present.

---

## Test Plan

1. **Backend unit** (`backend/src/data.test.ts`): **remove** the `getFriendsFeed` describe (71–94). **Add** a `getPaginatedPosts` describe: mock `post.findMany`/`post.count`; assert (a) `where.userId` is `{ in: [...] }` containing the caller and a friend id, (b) each returned row maps to `{ ...post, author }`, (c) `total` passes through. Reuse the existing `prismaMock` (`post.findMany`, `post.count`) and `postRow` fixture.
2. **Backend unit** (`backend/src/data.test.ts`): keep the `canCommentOnPost` and `comments` describes unchanged (they still pass — no signature change).
3. **Regression check** — grep confirms no remaining `getFriendsFeed`, `/api/feed`, or `feed.routes`/`feed.controller` references: `grep -rn "getFriendsFeed\|api/feed\|feed.routes\|feed.controller" backend/src` returns nothing.
4. **Frontend** — no runner configured; verify by `ng build` + manual (below).

---

## Migration / Rollback

- **No schema change.** This story only rewires queries, routes, and UI; the `Post`/`Comment`/`FriendRequest` tables are untouched.
- **Forward:** widen the list query, delete the feed endpoint + page.
- **Rollback:** restore `getFriendsFeed`, `feed.controller.ts`, `feed.routes.ts`, the `app.ts` mount, `getFeed`, `FeedComponent`, the `/feed` route, and the navbar link; revert `getPaginatedPosts` to `{ userId }` and `listPosts` to pass `req.userId!`.
- **Half-applied:** if the frontend deploys expecting `author` on `/api/posts` but the backend does not yet include it, cards render a blank author initial (no crash — `post.author?.name` guard optional). Deploy backend first.

---

## Verification Steps

1. **DB up:** `docker compose up -d` (from repo root).
2. **Backend builds/tests:** `cd backend && pnpm build && pnpm test` — `tsc` clean, Jest green (feed test removed, `getPaginatedPosts` test added).
3. **Frontend builds:** `cd frontend && pnpm build` — no reference to `FeedComponent`/`getFeed`/`/feed`.
4. **Manual (two friended accounts A & B):**
   - A opens `/` → sees **A's own posts and B's posts** interleaved newest-first, each showing the author name.
   - A's own cards show **Edit/Delete**; B's cards do **not**.
   - A expands comments on B's post, adds a comment → appears under the post with A's name.
   - A creates a post via the "New Post" modal → appears at top of A's list.
   - The **"Friends' Posts" navbar link is gone**; navigating to `/feed` redirects to `/`.
   - Search + date filters narrow the unified list.
5. **Regression:** create/edit modal, sidebars (online users / friends), notifications, and login/signup all still work.

---

## Done Criteria

- [ ] `GET /api/posts` returns the caller's own **and** accepted friends' posts, each carrying `author`, paginated newest-first, honouring `title`/`date` filters.
- [ ] `getFriendsFeed`, `/api/feed` route, `feed.controller.ts`, and `feed.routes.ts` are deleted; `app.ts` no longer mounts `/api/feed`.
- [ ] Main page renders the author + comments card for every post; Edit/Delete show only on the caller's own posts.
- [ ] `PUT`/`DELETE`/`GET /api/posts/:id` and comment permissions remain owner/friend-scoped (unchanged).
- [ ] `FeedComponent`, its template, the `/feed` route, the `getFeed` service method, and the "Friends' Posts" navbar link are removed.
- [ ] `CLAUDE.md` updated: `/api/posts` list documented as own+friends; the `/api/feed` section removed.
- [ ] `pnpm build` (both sides) and `pnpm test` (backend) pass.

**STOP HERE. Report to the user and wait for confirmation.**
