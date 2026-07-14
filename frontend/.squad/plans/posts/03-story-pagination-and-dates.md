# Story 03 — Pagination and date display on post cards

---

## Prerequisites

- Story 02 completed: edit-post modal, `PostListComponent` has create/edit modal integration, `PostFormComponent` embedded mode with `editPostId` input.

---

## Story Goal

Add server-side pagination to the posts list and display creation/edit dates on each post card.

1. The backend `GET /api/posts` endpoint accepts `?page=1&limit=10` query parameters and returns a paginated response with `data`, `total`, `page`, and `totalPages` fields.
2. The frontend requests one page at a time and renders Previous / Next navigation controls below the grid.
3. Pagination is only rendered when the total post count exceeds 10.
4. Each post card shows the creation date and, if the post has been edited, the last-edited date, formatted as `YYYY-MM-DD HH:mm`.
5. When no query params are provided, the API defaults to `page=1, limit=10` for backward compatibility.

**Not in scope:** filtering, sorting, infinite scroll, page-size selector.

---

## Context — Read These Files First

1. `backend/src/data.ts` — `getAllPosts` arrow function on line 15, returns the raw `posts` array with no arguments. Seed post on lines 5–13.
2. `backend/src/types.ts` — `Post` interface (lines 1–7) with `id`, `title`, `body`, `createdAt`, `updatedAt` as strings. `PostInput` interface (lines 9–12).
3. `backend/src/controllers/posts.controller.ts` — `listPosts` handler (lines 4–10). Line 6: `res.status(200).json(db.getAllPosts())` — returns full array, reads no query params.
4. `backend/src/routes/posts.routes.ts` — GET `/` route on line 7: `router.get('/', listPosts)` — no middleware.
5. `frontend/src/app/services/post.service.ts` — `getAll()` on lines 13–15: `this.http.get<Post[]>(this.baseUrl)` — no query params, returns `Observable<Post[]>`.
6. `frontend/src/app/models/post.model.ts` — `Post` interface (lines 1–7): `createdAt` and `updatedAt` are `string | undefined` (optional). No paginated wrapper type exists.
7. `frontend/src/app/components/post-list/post-list.component.ts` — `fetchPosts()` on lines 41–54: calls `getAll()`, assigns `this.posts = data`. Properties on lines 17–22: `posts: Post[]`, `loading`, `errorMessage`, `showCreateModal`, `showEditModal`, `editingPostId`.
8. `frontend/src/app/components/post-list/post-list.component.html` — Posts grid starting at line 65 with `*ngIf="!loading && posts.length > 0"`. Post count badge on line 16 shows `posts.length`. Metadata section at lines 88–106 shows hardcoded "2 min read" instead of dates. Empty state at lines 157–207. Modals at lines 210–225.

---

## Backend Tasks

### 1 — Add `PaginatedResponse` type

**File: `backend/src/types.ts`**

Add after the existing `PostInput` interface (after line 12):

```ts
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
```

---

### 2 — Add paginated query to data layer

**File: `backend/src/data.ts`**

Keep the existing `getAllPosts` unchanged (other controllers may use it). Add a new export below it (after line 15):

```ts
export const getPaginatedPosts = (
  page: number,
  limit: number
): { data: Post[]; total: number } => {
  const total = posts.length;
  const start = (page - 1) * limit;
  const data = posts.slice(start, start + limit);
  return { data, total };
};
```

---

### 3 — Update `listPosts` controller to paginate

**File: `backend/src/controllers/posts.controller.ts`**

Replace the `listPosts` function body (lines 4–10). Read `page` and `limit` from `req.query`, default to `1` and `10`, clamp to safe ranges, call `db.getPaginatedPosts`, and return the paginated shape.

```ts
export function listPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const { data, total } = db.getPaginatedPosts(page, limit);
    const totalPages = Math.ceil(total / limit);
    res.status(200).json({ data, total, page, totalPages });
  } catch (err) {
    next(err);
  }
}
```

The import on line 2 already imports `* as db` — no change needed.

---

### 4 — No changes to routes, middleware, or other controllers

- `posts.routes.ts` line 7 stays `router.get('/', listPosts)` — Express parses query strings automatically.
- `validatePost.ts` is not involved (GET has no body).
- `createPost`, `updatePost`, `removePost`, `getPost` controllers are unchanged.

---

## Frontend Tasks

### 5 — Add `PaginatedResponse` interface to the model

**File: `frontend/src/app/models/post.model.ts`**

Add after the `PostInput` interface (after line 12):

```ts
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
```

---

### 6 — Update `PostService.getAll()` to accept pagination params

**File: `frontend/src/app/services/post.service.ts`**

Import `HttpParams` alongside `HttpClient` (line 2):

```ts
import { HttpClient, HttpParams } from '@angular/common/http';
```

Import `PaginatedResponse` alongside `Post, PostInput` (line 5):

```ts
import { Post, PostInput, PaginatedResponse } from '../models/post.model';
```

Replace the `getAll()` method (lines 13–15) with:

```ts
getAll(page: number = 1, limit: number = 10): Observable<PaginatedResponse<Post>> {
  const params = new HttpParams()
    .set('page', page.toString())
    .set('limit', limit.toString());
  return this.http.get<PaginatedResponse<Post>>(this.baseUrl, { params });
}
```

---

### 7 — Add pagination state and logic to `PostListComponent`

**File: `frontend/src/app/components/post-list/post-list.component.ts`**

Import `PaginatedResponse` from the model (update the import on line 4):

```ts
import { Post, PaginatedResponse } from '../../models/post.model';
```

Add new properties after line 22 (after `editingPostId`):

```ts
currentPage = 1;
totalPages = 1;
totalPosts = 0;
pageSize = 10;
```

Replace the `fetchPosts()` method body (lines 41–54) to pass pagination params and extract the paginated response:

```ts
fetchPosts(): void {
  this.loading = true;
  this.errorMessage = '';
  this.postService.getAll(this.currentPage, this.pageSize).subscribe({
    next: (response) => {
      this.posts = response.data;
      this.totalPosts = response.total;
      this.totalPages = response.totalPages;
      this.currentPage = response.page;
      this.loading = false;
    },
    error: (err) => {
      this.errorMessage =
        err.error?.message || 'Failed to load posts. Please try again.';
      this.loading = false;
    },
  });
}
```

Add page-navigation methods:

```ts
goToPage(page: number): void {
  if (page < 1 || page > this.totalPages) return;
  this.currentPage = page;
  this.fetchPosts();
}

nextPage(): void {
  this.goToPage(this.currentPage + 1);
}

prevPage(): void {
  this.goToPage(this.currentPage - 1);
}
```

Update `onPostCreated()` (lines 68–71) to navigate to page 1 after creating a new post so the user sees the new post:

```ts
onPostCreated(): void {
  this.showCreateModal = false;
  this.currentPage = 1;
  this.fetchPosts();
}
```

`onPostUpdated()` (lines 82–86) stays on the current page — the updated post is on the same page the user was viewing. No change to the method body beyond what `fetchPosts()` already does.

After a `deletePost()` succeeds, if the current page becomes empty (was the last item on the page), fall back to the previous page:

```ts
deletePost(id: string): void {
  if (!confirm('Are you sure you want to delete this post?')) return;
  this.postService.remove(id).subscribe({
    next: () => {
      if (this.posts.length === 1 && this.currentPage > 1) {
        this.currentPage--;
      }
      this.fetchPosts();
    },
    error: () => {
      this.errorMessage = 'Failed to delete post.';
    },
  });
}
```

---

### 8 — Update the post list template: dates, count badge, and pagination controls

**File: `frontend/src/app/components/post-list/post-list.component.html`**

**8a — Post count badge (line 16):** Replace `posts.length` with `totalPosts` so it shows the total across all pages:

```html
{{ totalPosts }} {{ totalPosts === 1 ? "post" : "posts" }} available
```

**8b — Date display on post cards:** Replace the hardcoded "2 min read" metadata block (lines 88–106) with creation and edit dates. Use Angular's `DatePipe` (already available via `CommonModule` in the imports array).

```html
<div class="flex items-center gap-3 text-xs text-slate-400">
  <span *ngIf="post.createdAt" class="flex items-center gap-1">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
    {{ post.createdAt | date:'yyyy-MM-dd HH:mm' }}
  </span>
  <span *ngIf="post.updatedAt && post.updatedAt !== post.createdAt" class="flex items-center gap-1 text-amber-500">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
    Edited {{ post.updatedAt | date:'yyyy-MM-dd HH:mm' }}
  </span>
</div>
```

The "edited" date only shows when `updatedAt !== createdAt`, matching the acceptance criteria: "If a post is edited, the last edited date is displayed."

**8c — Pagination controls:** Add a new section **after** the posts grid closing `</div>` (after line 155) and **before** the empty-state block (line 157). Only render when `totalPages > 1`:

```html
<!-- Pagination -->
<nav
  *ngIf="!loading && totalPages > 1"
  class="flex items-center justify-center gap-2 pt-4"
  aria-label="Pagination"
>
  <button
    (click)="prevPage()"
    [disabled]="currentPage === 1"
    class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
    Previous
  </button>

  <span class="px-3 py-2 text-sm text-slate-500">
    Page {{ currentPage }} of {{ totalPages }}
  </span>

  <button
    (click)="nextPage()"
    [disabled]="currentPage === totalPages"
    class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  >
    Next
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  </button>
</nav>
```

---

## Edge Cases & Failure Modes

- **Fewer than 11 posts (no pagination needed):** `totalPages` is 1, the `*ngIf="totalPages > 1"` guard hides the pagination nav entirely. The list behaves exactly as before.
- **`page` query param exceeds total pages (e.g., `?page=999`):** The backend `posts.slice(start, start + limit)` returns an empty array. The frontend receives `{ data: [], total: N, page: 999, totalPages: M }` and renders the empty-state block. The user can click Previous to go back.
- **Non-numeric or negative `page`/`limit` query params:** The controller's `parseInt(...) || 1` and `Math.max(1, ...)` / `Math.min(100, ...)` guards in `posts.controller.ts` default to safe values. Enforced in the updated `listPosts` handler (Backend Task 3).
- **`limit=0` or `limit=-5`:** Clamped to `1` by `Math.max(1, ...)` in the controller.
- **Delete the last post on the current page:** `PostListComponent.deletePost()` checks `this.posts.length === 1 && this.currentPage > 1` and decrements `currentPage` before re-fetching, so the user lands on the previous page instead of seeing an empty page.
- **Create a post while on page 2+:** `onPostCreated()` resets `currentPage` to 1 so the user sees their new post (the in-memory array appends to the end, so the new post lands on the last page — but resetting to page 1 is a common UX convention).
- **`updatedAt === createdAt` (post never edited):** The "Edited" date is hidden by the `post.updatedAt !== post.createdAt` condition in the template. Only the creation date is shown.
- **`createdAt` or `updatedAt` is undefined:** The `*ngIf="post.createdAt"` / `*ngIf="post.updatedAt && ..."` guards prevent rendering. The `Post` model has these as optional fields.
- **Date format:** The Angular `DatePipe` with format `'yyyy-MM-dd HH:mm'` produces `2026-07-13 14:30`, matching the intake requirement `YYYY-MM-DD HH` (the intake likely means hour-level precision; `HH:mm` is a safe superset).
- **Backend restart clears all posts:** The in-memory store resets to 1 seed post. Pagination controls disappear (total ≤ 10). No error.

---

## Test Plan

No test framework is currently configured (`package.json` has no Karma/Jest). Manual testing only.

1. **Fewer than 11 posts — no pagination:** With ≤ 10 posts, confirm the pagination nav does not appear. The list shows all posts on one page.
2. **11+ posts — pagination appears:** Create 11+ posts (use the API directly: `for i in $(seq 1 12); do curl -X POST http://localhost:3000/api/posts -H "Content-Type: application/json" -d "{\"title\":\"Post $i title\",\"body\":\"Body for post number $i, which is long enough.\"}"; done`). Confirm the pagination nav appears below the grid.
3. **Page navigation:** Click Next → page 2 loads with remaining posts. Click Previous → page 1 loads. Previous is disabled on page 1. Next is disabled on the last page.
4. **Page indicator:** "Page 1 of 2" (or correct numbers) shown between the buttons.
5. **Post count badge:** Shows the total count (e.g., "12 posts available"), not just the current page count.
6. **Creation date on card:** Each post card shows the creation date formatted as `YYYY-MM-DD HH:mm`.
7. **Edited date on card:** Edit a post, return to list → the edited post card shows "Edited YYYY-MM-DD HH:mm" in amber text. Unedited posts do not show the edited label.
8. **Delete last post on page:** Navigate to page 2 (with 11 posts, page 2 has 1 post). Delete it → automatically redirected to page 1.
9. **Create post from page 2:** Navigate to page 2, click New Post, create a post → modal closes, navigates to page 1.
10. **API backward compat:** `curl http://localhost:3000/api/posts` (no query params) → returns `{ data: [...], total: N, page: 1, totalPages: M }` with up to 10 posts in `data`.
11. **API with explicit params:** `curl "http://localhost:3000/api/posts?page=2&limit=5"` → returns page 2 with up to 5 posts, correct `total` and `totalPages`.
12. **Edit/create modals still work:** Open create modal, submit → works. Open edit modal, submit → works. Both refresh the current page.

---

## Verification Steps

1. **Backend builds:** `cd backend && pnpm dev` — server starts with no TypeScript errors on port 3000.
2. **Frontend runs:** `cd frontend && pnpm start` — app compiles with no errors, opens at `http://localhost:4200`.
3. **API contract:** `curl -s http://localhost:3000/api/posts | jq .` — response includes `data` (array), `total` (number), `page` (number), `totalPages` (number).
4. **Regression:** Create post modal still works. Edit post modal still works. Delete with confirm dialog still works. No console errors.

---

## Done Criteria

- [ ] Backend `GET /api/posts` accepts `?page=&limit=` and returns `{ data, total, page, totalPages }`.
- [ ] Default page size is 10; no query params defaults to page 1, limit 10.
- [ ] Frontend requests one page at a time from the API.
- [ ] Pagination controls (Previous / Next + page indicator) appear only when total posts > 10.
- [ ] The list page shows a maximum of 10 posts per page.
- [ ] Post count badge shows total count, not current-page count.
- [ ] Each post card displays the creation date formatted as `YYYY-MM-DD HH:mm`.
- [ ] Edited posts show "Edited YYYY-MM-DD HH:mm"; unedited posts do not.
- [ ] Deleting the last post on a page falls back to the previous page.
- [ ] Creating a post navigates to page 1.
- [ ] No filtering or sorting changes (out of scope).
- [ ] No new npm dependencies added.
- [ ] Overview `00-overview.md` updated with this story.
