# Story 10 — Friends' posts feed + comments

---

## Prerequisites

- [Story 07 completed](07-story-friendship-domain-api.md): the `Friendship` relation and a way to resolve "who are my friends" (`listFriends` / a `friendIds` helper in `backend/src/friends.data.ts`). The feed query joins on it.
- [Story 09 completed](09-story-header-notifications.md): users can actually become friends end-to-end, so the feed has data.
- [Story 06 completed](../create-data-base/06-story-postgres-prisma-persistence.md): the `Post` model, owner scoping, `toPost` mapper, and pagination semantics this story extends.
- **Owner-scoped posts stay owner-scoped.** The existing `/api/posts` endpoints (`CLAUDE.md` "All post routes require auth and are owner-scoped") are **unchanged** — a user still sees only *their own* posts there. The friends' feed is a **separate, read-only** endpoint.

---

## Story Goal

Let a user read posts authored by their **friends** (not their own, not strangers') and add comments to those posts.

1. **Friends' feed** — `GET /api/feed` returns posts authored by the caller's accepted friends, each carrying the **author's name** (acceptance criterion 6), paginated like `/api/posts`.
2. **Comments model** — a `Comment` belongs to a `Post` and an author `User`.
3. **Add comment** — `POST /api/posts/:id/comments` lets a user comment on a **friend's** post (or their own); the comment stores author + content.
4. **Read comments** — `GET /api/posts/:id/comments` returns each comment with the **author's name** and content (acceptance criterion 7), ordered oldest→newest.
5. **UI** — a "Friends' Posts" view rendering author name + content per post, with an inline comment list and an add-comment form under each.

**Not in scope:** editing/deleting comments, nested replies, likes/reactions, commenting on strangers' posts, notifications for new comments, and real-time comment push.

---

## Product rules (from story)

| Behaviour | Current | New |
|---|---|---|
| `/api/posts` | Own posts only | **Unchanged** |
| Friends' posts | None | **`GET /api/feed` — friends' posts, read-only, with author name** |
| Comments | None | **`Comment` model; create + list on a post you own or a friend owns** |
| Comment authorship | N/A | **Stored `authorId`; returned with `author.name`** |
| Commenting permission | N/A | **Allowed on own or a friend's post; else 403/404** |

---

## Context — Read These Files First

1. `backend/src/data.ts` — **read whole (112 lines)**. `toPost` (8–17), `getPaginatedPosts` `where`/`skip`/`take`/`count` (35–71). The feed query mirrors this but scopes `userId` to `{ in: friendIds }` and joins the author. `createPost` (81–89) for the comment-create shape.
2. `backend/src/friends.data.ts` (from Story 07) — the helper returning accepted-friend ids for a user (`friendIds(userId): Promise<string[]>` or derive from `listFriends`). The feed and the comment-permission check both use it.
3. `backend/prisma/schema.prisma` — **lines 20–31** (`Post`). Add the `Comment` model + `comments Comment[]` back-relation on `Post` and `User`.
4. `backend/src/types.ts` — **lines 1–8** (`Post`). Add `Comment`, `CommentInput`, and a `FeedPost` (Post + `author: PublicUser`) type; also `PostWithAuthor` for the feed.
5. `backend/src/controllers/posts.controller.ts` — **read whole (100 lines)**. The `try/catch` + `next(err)` + status-code conventions to mirror in the feed and comment controllers; pagination parsing (`listPosts` lines 10–40) to reuse for the feed.
6. `backend/src/routes/posts.routes.ts` — **read whole (20 lines)**. `requireAuth` gating; add comment sub-routes here or in a new `feed.routes.ts` + comment routes.
7. `backend/src/middleware/validatePost.ts` — the `{ message, errors }` 400 contract; the comment validator returns the identical shape.
8. `frontend/src/app/components/post-list/post-list.component.ts` + `.html` — the fetch/loading/error/pagination pattern and the Tailwind card markup (`.html` lines 108–169) to mirror for the feed cards.
9. `frontend/src/app/services/post.service.ts` — **read whole (48 lines)**. Add feed + comment methods here or a new `FeedService`/`CommentService`.
10. `frontend/src/app/models/post.model.ts` — **read whole (21 lines)**. `Post`/`PaginatedResponse`; add `FeedPost` (with `author`) and `Comment` models.
11. `frontend/src/app/app.routes.ts` — **read whole (13 lines)**. Add a guarded `feed` route.

---

## Backend Tasks

### 1 — `Comment` model

**File: `backend/prisma/schema.prisma`** — add and back-relate:

```prisma
model Comment {
  id        String   @id @default(uuid())
  body      String
  createdAt DateTime @default(now())
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([postId])
}
```

Add `comments Comment[]` to both `Post` (lines 20–31) and `User` (lines 10–18). Run `pnpm prisma:migrate` (name `add_comments`) + `pnpm prisma:generate`.

### 2 — Types

**File: `backend/src/types.ts`** — append:

```ts
export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: PublicUser; // { id, name, email }
}
export interface CommentInput { body: string; }

// A post in the friends' feed carries its author for display.
export interface FeedPost extends Post { author: PublicUser; }
```

### 3 — Feed data + endpoint

**File: `backend/src/data.ts`** — add:

```ts
export const getFriendsFeed = async (
  friendIds: string[],
  page: number,
  limit: number,
): Promise<{ data: FeedPost[]; total: number }> => {
  if (friendIds.length === 0) return { data: [], total: 0 };
  const where: Prisma.PostWhereInput = { userId: { in: friendIds } };
  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where, orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit, take: limit,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.post.count({ where }),
  ]);
  return {
    data: rows.map((r) => ({ ...toPost(r), author: r.user })),
    total,
  };
};
```

**Create file: `backend/src/controllers/feed.controller.ts`** — `listFeed`: parse `page`/`limit` like `posts.controller.ts` lines 10–14, resolve `friendIds` via `friends.data`, return `{ data, total, page, totalPages }` (same envelope as `/api/posts`).

**Create file: `backend/src/routes/feed.routes.ts`** — `router.get("/", requireAuth, listFeed);`. Mount in `app.ts`: `app.use("/api/feed", feedRouter);`.

### 4 — Comments data + endpoints

**File: `backend/src/data.ts`** — add:

```ts
// Comment allowed only when the caller owns the post OR the post's owner is a friend.
export const canCommentOnPost = async (
  userId: string, postId: string, friendIds: string[],
): Promise<Post | null> => {
  const row = await prisma.post.findUnique({ where: { id: postId } });
  if (!row) return null;
  if (row.userId !== userId && !friendIds.includes(row.userId)) return null;
  return toPost(row);
};

export const addComment = async (
  postId: string, authorId: string, input: CommentInput,
): Promise<Comment> => {
  const row = await prisma.comment.create({
    data: { body: input.body.trim(), postId, authorId },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
  return { id: row.id, body: row.body, createdAt: row.createdAt.toISOString(), author: row.author };
};

export const listComments = async (postId: string): Promise<Comment[]> => {
  const rows = await prisma.comment.findMany({
    where: { postId }, orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((r) => ({ id: r.id, body: r.body, createdAt: r.createdAt.toISOString(), author: r.author }));
};
```

**Create file: `backend/src/middleware/validateComment.ts`** — mirror `validatePost.ts`: `body` required, **≥1 char after trimming** (comments are short; keep the trimmed-length rule but a lower floor than posts). Return `{ message: "Validation failed", errors: { body } }` on failure.

**Create file: `backend/src/controllers/comments.controller.ts`**:
- `createComment`: resolve `friendIds`; `const post = await canCommentOnPost(req.userId!, req.params.id, friendIds)`; if `!post` → **404** `{ message: "Post not found" }` (do not leak existence — matches `CLAUDE.md` 404-not-403 rule); else `addComment` → 201.
- `getComments`: same `canCommentOnPost` gate → 404 if not permitted; else `listComments` → 200.

**File: `backend/src/routes/posts.routes.ts`** — add:

```ts
router.get("/:id/comments", requireAuth, getComments);
router.post("/:id/comments", requireAuth, validateComment, createComment);
```

**Update `CLAUDE.md`** API Contract with the new `/api/feed` and `/api/posts/:id/comments` rows.

---

## Frontend Tasks

### 1 — Models

**File: `frontend/src/app/models/post.model.ts`** — append:

```ts
export interface Author { id: string; name: string; email: string; }
export interface FeedPost extends Post { author: Author; }
export interface Comment { id: string; body: string; createdAt: string; author: Author; }
export interface CommentInput { body: string; }
```

### 2 — Service methods

**File: `frontend/src/app/services/post.service.ts`** (or a new `FeedService`) — add:

```ts
getFeed(page = 1, limit = 10): Observable<PaginatedResponse<FeedPost>> { … GET ${apiUrl}/feed?page&limit }
getComments(postId: string): Observable<Comment[]> { … GET ${apiUrl}/posts/${postId}/comments }
addComment(postId: string, input: CommentInput): Observable<Comment> { … POST ${apiUrl}/posts/${postId}/comments }
```

### 3 — Friends' feed component

**Create file: `frontend/src/app/components/feed/feed.component.ts`** + `.html` (standalone, `CommonModule` + `ReactiveFormsModule` or `FormsModule`):
- Fetch `getFeed(page)` with `loading`/`error`/pagination, mirroring `post-list.component.ts`.
- Each card renders **author name** (new, vs the own-posts list) + title + body, reusing the `post-list.component.html` card Tailwind (lines 108–169) **minus** the Edit/Delete buttons (read-only — you can't edit a friend's post).
- Under each card: a comment list (lazy-load `getComments(post.id)` on expand, or eager) showing `author.name` + `body`; and an add-comment form (single `body` textarea, ≥1 char, submit → `addComment`, prepend/append result, show server 400 `errors.body` next to the field per `CLAUDE.md` frontend conventions).

**File: `frontend/src/app/app.routes.ts`** — add `{ path: "feed", component: FeedComponent, canActivate: [authGuard] }` (before `**`).

**File: `frontend/src/app/app.component.ts`** — add a navbar link to `/feed` ("Friends' Posts") in the actions block, gated `*ngIf="!isAuthPage && userName"`.

---

## Edge Cases & Failure Modes

- **No friends** — `getFriendsFeed` returns `{ data: [], total: 0 }` (early return when `friendIds` empty); the feed shows an empty state "No posts from friends yet".
- **Comment on a stranger's post** — `canCommentOnPost` returns `null` → **404** (not 403), enforced in `comments.controller.ts`; existence is not leaked.
- **Comment on own post** — allowed (`row.userId === userId` branch); useful so a user can reply on their own post in the feed context.
- **Post deleted mid-comment** — `canCommentOnPost` `findUnique` returns null → 404; `Comment.postId` FK is `onDelete: Cascade`, so deleting a post removes its comments.
- **Empty / whitespace-only comment** — rejected by `validateComment` (trimmed ≥1) with `{ errors: { body } }`; frontend shows the field error.
- **Friend un-friends after feed load** — a stale feed card may still show; posting a comment then 404s (re-checked server-side). Acceptable; the next feed fetch drops the card.
- **Author name for a deleted user** — `onDelete: Cascade` on `Comment.authorId`/`Post.userId` means comments/posts vanish with the user, so a dangling author cannot occur.
- **Pagination past the end** — `skip` beyond `total` returns `[]`; frontend clamps like `post-list`.
- **Feed leaking own posts** — feed scopes `userId: { in: friendIds }`; the caller's own id is **not** in `friendIds`, so own posts never appear in `/api/feed`. Verify `friendIds` excludes self.

---

## Test Plan

1. **Backend integration** (`backend/src/feed.routes.test.ts`): with A friends B, `GET /api/feed` as A returns B's posts (with `author.name`) and **not** A's own or a stranger C's; empty when A has no friends.
2. **Backend integration** (`backend/src/comments.routes.test.ts`): A can `POST /api/posts/:bPostId/comments` (201, returns `author.name`); A commenting on stranger C's post → 404; `GET …/comments` returns comments oldest→newest with author names; whitespace body → 400 `{ errors: { body } }`.
3. **Backend unit** (`backend/src/data.test.ts`): `canCommentOnPost` allows own + friend, denies stranger + missing.
4. **Frontend** — no runner configured; verify by build + manual.

---

## Migration / Rollback

- **Forward:** new `Comment` table + FKs + `@@index([postId])` (additive; no change to `Post`/`User` columns beyond back-relations, which are relation-only and need no SQL column).
- **Rollback:** `DROP TABLE "Comment";` and revert schema/types/controllers/routes. `/api/feed` and `/api/posts` continue to function without comments.
- **Half-applied:** if the migration applies but code isn't deployed, the extra table is inert. If code deploys without the migration, comment queries throw → 500; run the migration first.

---

## Verification Steps

1. **DB + migrate:** `docker compose up -d`; `cd backend && pnpm prisma:migrate && pnpm prisma:generate`.
2. **Backend builds/tests:** `cd backend && pnpm build && pnpm test`.
3. **Frontend builds:** `cd frontend && pnpm build`.
4. **Manual (two accounts, already friends via Stories 08–09):** A opens "Friends' Posts" → sees B's posts with B's name, not A's own; A adds a comment → appears under the post with A's name; B opens the same post → sees A's comment; A tries commenting on a non-friend's post id via curl → 404.
5. **Regression:** own-posts list (`/`), create/edit modal, sidebars, and notifications all still work.

---

## Done Criteria

- [ ] `Comment` model migrated with FKs to `Post` and `User` (cascade delete).
- [ ] `GET /api/feed` returns friends' posts (author name included), paginated, excluding own and strangers'.
- [ ] `POST /api/posts/:id/comments` allowed on own/friend's post (else 404), validates non-empty body, returns comment with author name.
- [ ] `GET /api/posts/:id/comments` returns comments oldest→newest with author names, gated by the same permission.
- [ ] Feed UI renders author + content per post with an inline comment list and add-comment form; server field errors shown.
- [ ] `CLAUDE.md` API Contract updated with `/api/feed` and comment routes.
- [ ] `pnpm build` (both) and `pnpm test` (backend) pass.

**STOP HERE. This completes the users feature. Report to the user.**
