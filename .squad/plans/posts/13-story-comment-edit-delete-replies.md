# Story 13 — Editable comments, replies, and sticky sidebars

---

## Prerequisites

- [Story 10 completed](../users/10-story-friends-posts-and-comments.md): the `Comment` model, `canCommentOnPost` / `addComment` / `listComments` in `backend/src/data.ts`, the `validateComment` middleware, the `/api/posts/:id/comments` routes, and the frontend comment thread in `PostListComponent`. This story extends all of them.
- [Story 12 completed](12-story-unified-posts-feed.md): comments render inline in the **unified** `PostListComponent` card (own + friends' posts on `/`). There is no `/feed` route — all comment UI lives in `post-list.component.html` (lines 189–256) and `post-list.component.ts` (lines 36–236).
- [Story 08 completed](../users/08-story-online-and-friends-sidebars.md): the two sidebars (`OnlineUsersComponent` = "Find friends", `FriendsListComponent` = "Friends") rendered in the app shell's 3-column grid (`app.component.ts` lines 134–149). The sticky requirement targets these two `<aside>` wrappers.

---

## Story Goal

Three user-visible outcomes:

1. **Edit + delete own comments** — a user can edit and delete comments **they authored** (on any post they can see — their own or a friend's). Author-scoped: another user's comment id on edit/delete returns **404** (existence not leaked — matches the `CLAUDE.md` 404-not-403 rule).
2. **Reply to a comment** — a user can reply to another user's (or their own) comment, producing a **one-level-deep** nested thread. A reply is a `Comment` with a `parentId` pointing at the comment it answers. Replies are also editable/deletable by their author.
3. **Sticky sidebars** — the "Friends" and "Find friends" sidebars stay pinned in view while the centre feed column scrolls (desktop `lg:` layout only).

**Not in scope:** replies nested deeper than one level (a reply to a reply is stored flat against the same top-level parent — see Product rules), comment likes/reactions, editing/deleting a **post** (already exists, unchanged), notifications for new comments/replies, real-time push, and pagination of comments.

---

## Product rules (from story)

| Behaviour | Current (Story 10/12) | New |
|---|---|---|
| Read comments | `GET /:id/comments` returns a flat list, oldest→newest | **Each comment carries `parentId: string \| null` and `authorId`** so the client can nest and gate edit/delete |
| Add comment | `POST /:id/comments` `{ body }` | **Optional `parentId`** in the body → the new comment is a reply to `parentId` |
| Edit comment | — | **`PUT /:id/comments/:commentId` `{ body }`** — author-scoped; 404 if not the author or missing |
| Delete comment | — | **`DELETE /:id/comments/:commentId`** — author-scoped; 404 if not the author or missing. Deleting a parent cascades to its replies (FK `onDelete: Cascade`) |
| Reply depth | Flat | **One level.** A `parentId` that itself points at a reply is **flattened** to the top-level ancestor server-side (see Backend Task 4) so the tree never exceeds depth 1 |
| Comment permission | Comment on own/friend's post | **Unchanged** — `canCommentOnPost` still gates create/read; edit/delete add an **author** check on top |
| Sidebars | Scroll with the page | **`sticky top-*`** so they stay in view |

---

## Context — Read These Files First

1. `backend/prisma/schema.prisma` — **lines 38–48** (`Comment`). Add `parentId String?` + self-relation (`parent`/`replies`). `User` (10–22) and `Post` (24–36) back-relations are unchanged.
2. `backend/src/types.ts` — **lines 72–81** (`Comment`, `CommentInput`). Add `authorId` + `parentId` to `Comment`; add optional `parentId` to `CommentInput`.
3. `backend/src/data.ts` — **read whole (177 lines)**. `toComment` (30–39), `addComment` (157–167), `listComments` (169–176), `canCommentOnPost` (146–155). You extend `toComment`/`addComment`/`listComments` and add `updateComment` / `deleteComment` mirroring the owner-scoped `updateMany`/`deleteMany` pattern in `updatePost` (121–133) / `deletePost` (135–141).
4. `backend/src/controllers/comments.controller.ts` — **read whole (42 lines)**. Mirror `createComment` (7–24) / `getComments` (26–41) `try/catch` + `friendIds` + `canCommentOnPost` + 404 conventions for the new `updateComment` / `deleteComment` handlers.
5. `backend/src/middleware/validateComment.ts` — **read whole (23 lines)**. Reused verbatim for `PUT` (same `{ body }` rule). `parentId` is **not** validated here (optional, controller-checked).
6. `backend/src/routes/posts.routes.ts` — **read whole (28 lines)**. Add `PUT` + `DELETE` comment sub-routes after lines 25–26.
7. `backend/src/data.test.ts` — **read whole (147 lines)**. The `prismaMock` + `describe`/`it` pattern to extend for `updateComment` / `deleteComment` / reply flattening. Note the mock only stubs `comment.create`/`findMany` (lines 9–12) — add `comment.updateMany` / `comment.deleteMany` / `comment.findUnique`.
8. `frontend/src/app/models/post.model.ts` — **lines 33–42** (`Comment`, `CommentInput`). Add `authorId` + `parentId` to `Comment`; add optional `parentId` to `CommentInput`.
9. `frontend/src/app/services/post.service.ts` — **read whole (63 lines)**. `getComments` (56–58) / `addComment` (60–62). Add `updateComment` / `deleteComment`; extend `addComment` to pass `parentId`.
10. `frontend/src/app/components/post-list/post-list.component.ts` — **read whole (237 lines)**. Comment state (36–43), `loadComments` (192–202), `submitComment` (208–236). Add reply-draft, edit-draft, and delete state + methods here. `currentUserId` (34, set at 58) already exists — reuse for the author check.
11. `frontend/src/app/components/post-list/post-list.component.html` — **lines 212–255** (comment thread + add-comment form). Extend to render replies nested, per-comment Edit/Delete/Reply actions, and inline edit/reply forms.
12. `frontend/src/app/app.component.ts` — **lines 134–149** (the 3-column grid + the two `<aside>` host components). Apply `sticky` to the sidebar host elements here (the grid parent is `<main>`, which is fine for sticky since it is tall enough).
13. `CLAUDE.md` — **the `/api/posts` table** (comment rows) and the **Comment response shape**. Update both with the new routes and the `parentId`/`authorId` fields.

---

## Backend Tasks

### 1 — Schema: self-relation on `Comment`

**File: `backend/prisma/schema.prisma`** — extend the `Comment` model (lines 38–48):

```prisma
model Comment {
  id        String   @id @default(uuid())
  body      String
  createdAt DateTime @default(now())
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  parentId  String?
  parent    Comment? @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies   Comment[] @relation("CommentReplies")

  @@index([postId])
  @@index([parentId])
}
```

`parentId` is **nullable** (top-level comments have none). `onDelete: Cascade` on the self-relation means deleting a parent deletes its replies. Run `pnpm prisma:migrate` (name `add_comment_parent`) then `pnpm prisma:generate`.

### 2 — Types

**File: `backend/src/types.ts`** — replace the `Comment` / `CommentInput` block (lines 72–81):

```ts
export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  authorId: string; // for the client edit/delete author gate
  parentId: string | null; // null = top-level; else the comment it replies to
  author: PublicUser; // { id, name, email }
}

export interface CommentInput {
  body: string;
  parentId?: string; // present → the new comment is a reply
}
```

### 3 — Data layer: extend `toComment`, add update/delete

**File: `backend/src/data.ts`**

Extend `toComment` (lines 30–39) to carry the two new fields:

```ts
function toComment(
  row: Prisma.CommentGetPayload<{ include: { author: { select: typeof publicUserSelect } } }>,
): Comment {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    authorId: row.authorId,
    parentId: row.parentId,
    author: row.author,
  };
}
```

Add (mirror the owner-scoped `updateMany`/`deleteMany` pattern from `updatePost`/`deletePost`):

```ts
// Author-scoped edit: updateMany returns count, so "not mine / missing" is
// indistinguishable from the caller's view (controller answers 404 either way).
export const updateComment = async (
  authorId: string,
  commentId: string,
  body: string,
): Promise<Comment | undefined> => {
  const result = await prisma.comment.updateMany({
    where: { id: commentId, authorId },
    data: { body: body.trim() },
  });
  if (result.count === 0) return undefined;
  const row = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { author: { select: publicUserSelect } },
  });
  return row ? toComment(row) : undefined;
};

// Author-scoped delete. Replies cascade via the FK. Returns false when the
// comment is missing or not authored by the caller.
export const deleteComment = async (
  authorId: string,
  commentId: string,
): Promise<boolean> => {
  const result = await prisma.comment.deleteMany({
    where: { id: commentId, authorId },
  });
  return result.count > 0;
};
```

### 4 — Reply flattening in `addComment`

**File: `backend/src/data.ts`** — extend `addComment` (lines 157–167) to accept and normalise `parentId` so the tree never exceeds one level:

```ts
export const addComment = async (
  postId: string,
  authorId: string,
  input: CommentInput,
): Promise<Comment> => {
  // Normalise parentId to a top-level ancestor: replying to a reply attaches to
  // that reply's parent, so depth is capped at 1. A parentId that doesn't exist
  // or belongs to another post is dropped (treated as a top-level comment).
  let parentId: string | null = null;
  if (input.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: input.parentId },
    });
    if (parent && parent.postId === postId) {
      parentId = parent.parentId ?? parent.id;
    }
  }

  const row = await prisma.comment.create({
    data: { body: input.body.trim(), postId, authorId, parentId },
    include: { author: { select: publicUserSelect } },
  });
  return toComment(row);
};
```

`listComments` (lines 169–176) needs **no change** — it already returns the whole flat list oldest→newest; the client nests by `parentId`.

### 5 — Controllers

**File: `backend/src/controllers/comments.controller.ts`**

- Extend `createComment` (lines 7–24) to forward `parentId` into the input:

```ts
const comment = await db.addComment(req.params.id, req.userId!, {
  body: req.body.body,
  parentId: typeof req.body.parentId === "string" ? req.body.parentId : undefined,
});
```

- Add two handlers. Both first re-run the `canCommentOnPost` gate (so a comment on a post you can no longer see → 404), then delegate to the author-scoped data functions (which enforce authorship):

```ts
export async function updateComment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const ids = await friendIds(req.userId!);
    const post = await db.canCommentOnPost(req.userId!, req.params.id, ids);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const updated = await db.updateComment(
      req.userId!,
      req.params.commentId,
      req.body.body,
    );
    if (!updated) return res.status(404).json({ message: "Comment not found" });
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function removeComment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const ids = await friendIds(req.userId!);
    const post = await db.canCommentOnPost(req.userId!, req.params.id, ids);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const deleted = await db.deleteComment(req.userId!, req.params.commentId);
    if (!deleted) return res.status(404).json({ message: "Comment not found" });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
```

### 6 — Routes

**File: `backend/src/routes/posts.routes.ts`** — after the existing comment routes (lines 25–26), add and update the import block (lines 12–15):

```ts
import {
  createComment,
  getComments,
  updateComment,
  removeComment,
} from "../controllers/comments.controller";
```

```ts
router.put("/:id/comments/:commentId", requireAuth, validateComment, updateComment);
router.delete("/:id/comments/:commentId", requireAuth, removeComment);
```

`validateComment` is reused on `PUT` (same `{ body }` ≥1-trimmed rule).

### 7 — CLAUDE.md

Update the `/api/posts` table with the two new rows and the **Comment response shape** to include `authorId` and `parentId`:

```
| PUT    | /:id/comments/:commentId | ✅ | `{ body }` | 200 `Comment` | 400 · 401 · 404 · 500 |
| DELETE | /:id/comments/:commentId | ✅ | —          | 204 (no body) | 401 · 404 · 500       |
```

```ts
// Comment — now carries authorId (client edit/delete gate) + parentId (nesting)
{ id, body, createdAt, authorId, parentId: string | null, author: { id, name, email } }
```

Note in the comments prose that `POST /:id/comments` accepts an optional `parentId` (reply), that replies are flattened to one level, and that **edit/delete are author-scoped** (404 for a comment you didn't author).

---

## Frontend Tasks

### 1 — Models

**File: `frontend/src/app/models/post.model.ts`** — replace the `Comment` / `CommentInput` block (lines 33–42):

```ts
export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  parentId: string | null;
  author: Author;
}

export interface CommentInput {
  body: string;
  parentId?: string;
}
```

### 2 — Service

**File: `frontend/src/app/services/post.service.ts`** — `addComment` (lines 60–62) already forwards the whole `input` object, so passing `parentId` requires **no change** there. Add:

```ts
updateComment(
  postId: string,
  commentId: string,
  body: string,
): Observable<Comment> {
  return this.http.put<Comment>(
    `${this.baseUrl}/${postId}/comments/${commentId}`,
    { body },
  );
}

deleteComment(postId: string, commentId: string): Observable<void> {
  return this.http.delete<void>(
    `${this.baseUrl}/${postId}/comments/${commentId}`,
  );
}
```

### 3 — Component state + methods

**File: `frontend/src/app/components/post-list/post-list.component.ts`**

Add state near the existing comment state (lines 36–43):

```ts
// Reply / edit UI state, keyed by comment id.
replyingTo = new Set<string>();          // comment ids with an open reply box
replyDrafts: Record<string, string> = {};
editingComment = new Set<string>();      // comment ids being edited inline
editDrafts: Record<string, string> = {};
commentActionError: Record<string, string> = {}; // keyed by comment id
```

Add a helper that groups a post's flat comment list into top-level + replies (called from the template):

```ts
// Top-level comments for a post, newest of the thread order preserved (oldest→newest).
topLevel(postId: string): Comment[] {
  return (this.comments[postId] ?? []).filter((c) => c.parentId === null);
}

repliesFor(postId: string, parentId: string): Comment[] {
  return (this.comments[postId] ?? []).filter((c) => c.parentId === parentId);
}

isOwnComment(comment: Comment): boolean {
  return !!this.currentUserId && comment.authorId === this.currentUserId;
}
```

Extend `submitComment` (lines 208–236) — accept an optional `parentId`, read from `replyDrafts` when replying, and on success **refetch the thread** (simplest correct nesting; the appended-reply order otherwise drifts). Reuse the existing `loadComments` by clearing `commentsLoaded` for that post then calling it, or append then re-sort by `createdAt`. Concretely, after a successful `addComment`, call a private `reloadComments(postId)` that re-fetches and repopulates `this.comments[postId]`.

Add reply / edit / delete methods:

```ts
startReply(commentId: string): void {
  this.replyingTo.add(commentId);
  this.replyDrafts[commentId] = "";
}
cancelReply(commentId: string): void {
  this.replyingTo.delete(commentId);
}
submitReply(postId: string, parentId: string): void {
  const body = (this.replyDrafts[parentId] ?? "").trim();
  this.commentActionError[parentId] = "";
  if (!body) { this.commentActionError[parentId] = "Reply is required."; return; }
  this.postService.addComment(postId, { body, parentId }).subscribe({
    next: () => {
      this.replyingTo.delete(parentId);
      this.replyDrafts[parentId] = "";
      this.reloadComments(postId);
    },
    error: (err: HttpErrorResponse) =>
      (this.commentActionError[parentId] =
        err.status === 400 && err.error?.errors?.body
          ? err.error.errors.body
          : "Couldn't add your reply."),
  });
}

startEdit(comment: Comment): void {
  this.editingComment.add(comment.id);
  this.editDrafts[comment.id] = comment.body;
}
cancelEdit(commentId: string): void {
  this.editingComment.delete(commentId);
}
saveEdit(postId: string, commentId: string): void {
  const body = (this.editDrafts[commentId] ?? "").trim();
  this.commentActionError[commentId] = "";
  if (!body) { this.commentActionError[commentId] = "Comment is required."; return; }
  this.postService.updateComment(postId, commentId, body).subscribe({
    next: (updated) => {
      this.editingComment.delete(commentId);
      this.comments[postId] = (this.comments[postId] ?? []).map((c) =>
        c.id === commentId ? updated : c,
      );
    },
    error: (err: HttpErrorResponse) =>
      (this.commentActionError[commentId] =
        err.status === 400 && err.error?.errors?.body
          ? err.error.errors.body
          : err.status === 404
            ? "This comment is no longer available."
            : "Couldn't save your edit."),
  });
}

deleteComment(postId: string, commentId: string): void {
  if (!confirm("Delete this comment?")) return;
  this.postService.deleteComment(postId, commentId).subscribe({
    next: () => this.reloadComments(postId), // cascade may remove replies too
    error: () =>
      (this.commentActionError[commentId] = "Couldn't delete the comment."),
  });
}
```

Add the private `reloadComments` (re-fetch, replacing the current `loadComments` inline `next`):

```ts
private reloadComments(postId: string): void {
  this.postService.getComments(postId).subscribe({
    next: (comments) => {
      this.comments[postId] = comments;
      this.commentsLoaded.add(postId);
    },
    error: () => (this.commentErrors[postId] = "Couldn't load comments."),
  });
}
```

`loadComments` (192–202) may delegate to `reloadComments`.

### 4 — Template: nested thread + per-comment actions

**File: `frontend/src/app/components/post-list/post-list.component.html`** — rework the comment `<ul>` (lines 225–237). Iterate **top-level** comments via `topLevel(post.id)`; under each, render `repliesFor(post.id, comment.id)` in a nested indented `<ul>` (e.g. `ml-6 border-l border-slate-200 pl-3`). For **every** comment (top-level and reply), render:

- author name + body (existing markup, lines 230–235);
- when `isOwnComment(comment)`: **Edit** and **Delete** buttons (Tailwind mirroring the post owner-action buttons, `post-list.component.html` lines 138–179, sized down);
- a **Reply** button on **top-level** comments only (replies attach to the top-level ancestor server-side, and the UI keeps depth 1);
- when `editingComment.has(comment.id)`: an inline `<textarea [(ngModel)]="editDrafts[comment.id]">` + **Save**/**Cancel** (call `saveEdit`/`cancelEdit`), replacing the static body;
- when `replyingTo.has(comment.id)`: an inline reply `<textarea [(ngModel)]="replyDrafts[comment.id]">` + **Reply**/**Cancel** (call `submitReply(post.id, comment.id)`/`cancelReply`);
- `commentActionError[comment.id]` shown as `text-xs text-rose-600` under the comment.

The existing add-comment form (lines 240–254) stays as the **top-level** composer.

### 5 — Sticky sidebars

**File: `frontend/src/app/app.component.ts`** — the sidebar hosts are `<app-online-users>` (lines 139–142) and `<app-friends-list>` (lines 144–147), each with `class="hidden lg:block"`. Add sticky positioning so they pin below the sticky navbar (`h-16` = 4rem; use `top-24` to clear it plus the `pt-8` on `<main>`), and cap height so long lists scroll internally:

```html
<app-online-users
  *ngIf="!isAuthPage"
  class="hidden lg:block lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
></app-online-users>
```

Same classes on `<app-friends-list>`. `lg:self-start` is required so the grid item doesn't stretch to full row height (which would defeat `sticky`). No change inside the sidebar components themselves.

---

## Edge Cases & Failure Modes

- **Edit/delete a comment you didn't author** — `updateComment`/`deleteComment` scope `where: { id, authorId }`; `count === 0` → controller returns **404** (`comments.controller.ts` new handlers). Existence not leaked (matches `CLAUDE.md`).
- **Edit/delete on a post you can no longer see** (un-friended after load) — `canCommentOnPost` gate in both new handlers returns null → **404** before the author check runs.
- **Reply to a reply** — `addComment` flattens: `parentId = parent.parentId ?? parent.id` (`data.ts` Task 4), so the stored `parentId` is always a top-level comment. Depth never exceeds 1.
- **Reply with a `parentId` from another post or a non-existent id** — `addComment` drops it (`parent.postId === postId` guard fails) and stores the comment as top-level rather than erroring.
- **Delete a parent with replies** — the self-relation FK `onDelete: Cascade` removes the replies in the same DB operation; the frontend `reloadComments` then reflects the reduced list.
- **Empty / whitespace-only edit or reply** — client guards (`saveEdit`/`submitReply` trim-check) and server `validateComment` (≥1 trimmed) both reject with `{ errors: { body } }`; the field error shows under the comment.
- **Concurrent edit then delete** — edit resolves against a now-deleted comment → `updateComment` `count === 0` → 404; the client shows "This comment is no longer available." and the next `reloadComments` (e.g. after any action) drops it.
- **Sticky sidebar taller than the viewport** — `lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto` lets the aside scroll internally instead of overflowing the pinned box.
- **Sticky on mobile** — the sticky classes are `lg:`-prefixed only; the mobile single-column layout (`grid-cols-1`, sidebars `hidden`) is unaffected.

---

## Test Plan

1. **Backend unit** (`backend/src/data.test.ts`, extend the existing `describe("comments")` block): add cases for
   - `updateComment` returns the updated comment when `updateMany` count is 1 (mock `comment.updateMany` → `{ count: 1 }`, `comment.findUnique` → row) and `undefined` when count is 0;
   - `deleteComment` returns `true`/`false` from `comment.deleteMany` count;
   - `addComment` flattening: a `parentId` pointing at a reply (mock `comment.findUnique` → a row with a non-null `parentId`) stores the **ancestor's** id; a `parentId` on another post is dropped to `null`.
   - Extend the `prismaMock.comment` object (lines 9–12) with `updateMany`, `deleteMany`, `findUnique`.
2. **Backend unit** (`backend/src/data.test.ts`): assert `toComment` output now includes `authorId` and `parentId` (extend the existing "lists comments oldest-first" expectation to check the new fields are present).
3. **Frontend** — no runner configured (`CLAUDE.md`: "no test suite on either side"). Verify by `ng build` + manual (below).

_(There is no HTTP-level integration test suite in `backend/src` — only the data-layer `*.test.ts` files. Do **not** invent a supertest harness; keep tests at the data-module level to match the established pattern.)_

---

## Migration / Rollback

- **Forward:** additive nullable column `parentId` on `Comment` + a self-relation FK + `@@index([parentId])`. Existing comments get `parentId = NULL` (top-level) automatically. Migration name `add_comment_parent`.
- **Rollback:** `ALTER TABLE "Comment" DROP COLUMN "parentId";` and revert schema/types/controllers/routes. Existing flat comments continue to work; the `PUT`/`DELETE` comment routes return 404s only if code is reverted too.
- **Half-applied:** if the migration applies but code isn't deployed, `parentId` is an inert nullable column. If code deploys without the migration, `comment.create` with `parentId` and the self-relation query throw → 500; run the migration first.

---

## Verification Steps

1. **DB + migrate:** `docker compose up -d`; `cd backend && pnpm prisma:migrate && pnpm prisma:generate`.
2. **Backend builds/tests:** `cd backend && pnpm build && pnpm test`.
3. **Frontend builds:** `cd frontend && pnpm build`.
4. **Manual (two accounts A, B already friends):**
   - A opens `/`, expands a post's comments, adds a comment → appears; A edits it → body updates inline; A deletes it → disappears.
   - B (viewing A's post as a friend) replies to A's comment → the reply renders indented under A's comment; A sees B's reply.
   - A tries to edit/delete **B's** comment → no Edit/Delete buttons shown (author gate); a direct `curl -X DELETE .../comments/<B-comment-id>` as A → **404**.
   - Reply to a reply via the UI → it attaches at the same (top) level, not deeper.
   - Scroll the centre feed on a `lg` viewport → both "Friends" and "Find friends" sidebars stay pinned; a long list scrolls inside its own box.
5. **Regression:** creating/editing/deleting **posts**, search/date filters, pagination, sidebars' 30s polling, and notifications all still work.

---

## Done Criteria

- [ ] `Comment.parentId` migrated (nullable, self-relation, cascade delete, `@@index([parentId])`).
- [ ] `PUT /api/posts/:id/comments/:commentId` edits an **author's own** comment (400 on empty body, 404 otherwise).
- [ ] `DELETE /api/posts/:id/comments/:commentId` deletes an author's own comment (404 otherwise); replies cascade.
- [ ] `POST /api/posts/:id/comments` accepts optional `parentId`; replies are flattened to one level; cross-post/invalid `parentId` degrades to top-level.
- [ ] `Comment` response carries `authorId` and `parentId`; frontend `Comment`/`CommentInput` match.
- [ ] Feed UI: per-comment Edit/Delete on own comments, Reply on top-level comments, inline edit/reply forms, nested reply rendering, field errors shown.
- [ ] "Friends" and "Find friends" sidebars are sticky on `lg:` and scroll internally when tall.
- [ ] `CLAUDE.md` API Contract + Comment shape updated.
- [ ] `pnpm build` (both) and `pnpm test` (backend) pass.

**STOP HERE. Report to the user and wait for confirmation.**
