# Story 04 — Search posts by title and filter by date

---

## Prerequisites

- [Story 03 completed](03-story-pagination-and-dates.md): server-side pagination on `GET /api/posts`, `PaginatedResponse<T>` envelope, `getPaginatedPosts(page, limit)` in the data layer, and `PostListComponent` page navigation. This story extends every one of those touchpoints — filtering must be applied **before** pagination so `total`/`totalPages` reflect the filtered set.
- **All search and filtering logic lives on the backend.** The frontend only sends query parameters and renders the returned page. Do not filter client-side.

---

## Story Goal

Let a user find posts by title keyword and narrow them to a creation-date range, both handled by the backend API.

1. `GET /api/posts` accepts a `title` query param and returns only posts whose **title contains** the keyword (case-insensitive, substring match).
2. `GET /api/posts` accepts date-range params (`startDate` and/or `endDate`, `YYYY-MM-DD`) and returns only posts whose `createdAt` falls within the range (inclusive of both boundary days).
3. Search and date filters combine: when both are supplied, a post must match **both** conditions.
4. Filtering runs **before** pagination, so `total` and `totalPages` in the response envelope describe the filtered result set, and `page` navigation walks the filtered results.
5. The list page renders a search input and two date inputs (from / to) above the grid; changing any of them resets to page 1 and re-queries the backend.
6. When no posts match the active filters, the list shows a distinct **"No posts found"** empty state, separate from the existing "No posts yet" (zero-posts) state.

**Not in scope:** full-text search over the body, sorting, tag/category filters, fuzzy matching, saved searches, or URL query-param persistence of the filter state.

---

## Context — Read These Files First

1. `backend/src/data.ts` — `getPaginatedPosts(page, limit)` arrow function, **lines 8–16**. It slices the module-level `posts` array (line 6, seeded from `initialPosts`). This is the single function to extend with filtering.
2. `backend/src/controllers/posts.controller.ts` — `listPosts` handler, **lines 4–14**. Lines 6–7 parse `page`/`limit` from `req.query`; line 8 calls `db.getPaginatedPosts(page, limit)`; line 10 responds `{ data, total, page, totalPages }`. Add the new query params here.
3. `backend/src/routes/posts.routes.ts` — **line 7**, `router.get('/', listPosts)`. No route change needed; query params ride on the existing GET.
4. `backend/src/types.ts` — `Post` interface **lines 1–7** (`createdAt: string`, ISO), `PaginatedResponse<T>` **lines 14–19**. Add a filter-options type here.
5. `backend/src/initialPosts.ts` — **lines 4–15**: 50 seed posts, `createdAt` staggered one hour apart (`Date.now() - (50 - index) * 3600000`), so seeded dates span roughly the last ~50 hours. Useful for exercising the date filter manually.
6. `frontend/src/app/services/post.service.ts` — `getAll(page, limit)`, **lines 13–18**, builds `HttpParams` and returns `Observable<PaginatedResponse<Post>>`. Extend its signature to carry the filters.
7. `frontend/src/app/components/post-list/post-list.component.ts` — properties **lines 17–27** (`posts`, `currentPage`, `pageSize`, etc.), `fetchPosts()` **lines 45–62** (calls `getAll(this.currentPage, this.pageSize)`), `goToPage/nextPage/prevPage` **lines 107–119**. Note `Subscription` is already imported from `rxjs` (line 8).
8. `frontend/src/app/components/post-list/post-list.component.html` — header/count-badge block **lines 3–20** (insert the filter controls here), posts grid **line 66**, pagination nav **lines 177–226**, and the existing empty state **lines 228–278** (`*ngIf="!loading && posts.length === 0 && !errorMessage"`, heading "No posts yet" at line 251).
9. `frontend/src/app/models/post.model.ts` — `Post` **lines 1–7**, `PaginatedResponse<T>` **lines 14–19**. No change required, but confirm the envelope shape matches the backend.

**Styling note (important):** despite `CLAUDE.md` describing global SCSS utility classes, the live components are styled with **Tailwind CSS** utility classes (see the header at `post-list.component.html` lines 3–20 and inputs across `post-form`). Match the existing Tailwind classes — do **not** introduce `.container`/`.card` SCSS classes.

---

## Backend Tasks

### 1 — Add a `PostFilters` type

**File: `backend/src/types.ts`**

Add after `PaginatedResponse<T>` (after line 19):

```ts
export interface PostFilters {
  title?: string;
  startDate?: string; // YYYY-MM-DD (inclusive, start of day UTC)
  endDate?: string; // YYYY-MM-DD (inclusive, end of day UTC)
}
```

---

### 2 — Apply filters before pagination in the data layer

**File: `backend/src/data.ts`**

Import the new type on line 2 alongside the existing imports:

```ts
import { Post, PostInput, PostFilters } from "./types";
```

Replace `getPaginatedPosts` (lines 8–16) so it filters the array first, then paginates the filtered result. Keep the existing return shape `{ data, total }`:

```ts
export const getPaginatedPosts = (
  page: number,
  limit: number,
  filters: PostFilters = {},
): { data: Post[]; total: number } => {
  const term = filters.title?.trim().toLowerCase();
  const from = filters.startDate
    ? new Date(`${filters.startDate}T00:00:00.000Z`)
    : undefined;
  const to = filters.endDate
    ? new Date(`${filters.endDate}T23:59:59.999Z`)
    : undefined;

  const filtered = posts.filter((p) => {
    if (term && !p.title.toLowerCase().includes(term)) return false;
    if (from || to) {
      const created = new Date(p.createdAt);
      if (from && created < from) return false;
      if (to && created > to) return false;
    }
    return true;
  });

  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);
  return { data, total };
};
```

- **Title match:** case-insensitive substring on `p.title` after trimming the term. An empty/whitespace-only `title` param is treated as "no title filter".
- **Date match:** compare against `p.createdAt` (ISO string) using UTC day boundaries so the range is inclusive of both the `startDate` and `endDate` calendar days.
- **Invalid date strings** (`new Date(...)` → `Invalid Date`) make every comparison `false`, so a malformed `startDate`/`endDate` yields an empty result rather than a crash — see Edge Cases.

---

### 3 — Read filter params in the controller

**File: `backend/src/controllers/posts.controller.ts`**

In `listPosts` (lines 4–14), after the `limit` line (line 7) and before the `getPaginatedPosts` call, read the filter params and pass them through. Support `date` as a shorthand that pins both bounds to a single day:

```ts
const title = typeof req.query.title === "string" ? req.query.title : undefined;
const singleDate =
  typeof req.query.date === "string" ? req.query.date : undefined;
const startDate =
  singleDate ??
  (typeof req.query.startDate === "string" ? req.query.startDate : undefined);
const endDate =
  singleDate ??
  (typeof req.query.endDate === "string" ? req.query.endDate : undefined);

const { data, total } = db.getPaginatedPosts(page, limit, {
  title,
  startDate,
  endDate,
});
```

Leave the `totalPages`/response lines (9–10) unchanged. The envelope stays `{ data, total, page, totalPages }`.

---

## Frontend Tasks

### 4 — Thread filters through the service

**File: `frontend/src/app/services/post.service.ts`**

Extend `getAll` (lines 13–18) to accept an optional filters object and append params only when present (so empty filters keep the current URL clean):

```ts
getAll(
  page: number = 1,
  limit: number = 10,
  filters: { title?: string; startDate?: string; endDate?: string } = {},
): Observable<PaginatedResponse<Post>> {
  let params = new HttpParams()
    .set('page', page.toString())
    .set('limit', limit.toString());
  if (filters.title?.trim()) params = params.set('title', filters.title.trim());
  if (filters.startDate) params = params.set('startDate', filters.startDate);
  if (filters.endDate) params = params.set('endDate', filters.endDate);
  return this.http.get<PaginatedResponse<Post>>(this.baseUrl, { params });
}
```

---

### 5 — Add filter state and debounced search to the list component

**File: `frontend/src/app/components/post-list/post-list.component.ts`**

- Update the `rxjs` import (line 8) to add `Subject`: `import { Subscription, Subject } from "rxjs";` and add `import { debounceTime } from "rxjs/operators";`.
- Add filter properties beside the pagination fields (after line 26):

```ts
searchTerm = "";
startDate = "";
endDate = "";
private search$ = new Subject<void>();
```

- In `ngOnInit` (lines 34–39), wire a debounced re-query so typing in the search box doesn't fire a request per keystroke:

```ts
this.sub?.add(
  this.search$.pipe(debounceTime(500)).subscribe(() => {
    this.currentPage = 1;
    this.fetchPosts();
  }),
);
```

Ensure `this.sub` is initialized as a `Subscription` before calling `.add` (assign `this.sub = new Subscription()` at the top of `ngOnInit`, then `this.sub.add(this.createTrigger.trigger$.subscribe(...))` for the existing trigger subscription on lines 36–38).

- Update `fetchPosts()` (lines 45–62) to pass the current filters:

```ts
this.postService
  .getAll(this.currentPage, this.pageSize, {
    title: this.searchTerm,
    startDate: this.startDate,
    endDate: this.endDate,
  })
  .subscribe({
    /* unchanged next/error handlers */
  });
```

- Add handler methods (after `prevPage`, around line 119):

```ts
onSearchChange(): void {
  this.search$.next();
}

onDateChange(): void {
  this.currentPage = 1;
  this.fetchPosts();
}

clearFilters(): void {
  this.searchTerm = "";
  this.startDate = "";
  this.endDate = "";
  this.currentPage = 1;
  this.fetchPosts();
}

get hasActiveFilters(): boolean {
  return !!(this.searchTerm.trim() || this.startDate || this.endDate);
}
```

- `CommonModule` is already imported (line 2); add `FormsModule` to `imports` (line 13) for `[(ngModel)]` binding on the inputs: `import { FormsModule } from "@angular/forms";`.

---

### 6 — Render filter controls and the "No posts found" state

**File: `frontend/src/app/components/post-list/post-list.component.html`**

- Insert a filter bar directly under the header block (after line 20, before the loading state at line 22). Match the existing Tailwind style of the header. Bind with `ngModel`:

```html
<!-- Filter bar -->
<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
  <div class="flex-1">
    <label class="block text-xs font-semibold text-slate-500 mb-1"
      >Search title</label
    >
    <input
      type="text"
      [(ngModel)]="searchTerm"
      (ngModelChange)="onSearchChange()"
      placeholder="Search posts by title…"
      class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
    />
  </div>
  <div>
    <label class="block text-xs font-semibold text-slate-500 mb-1">From</label>
    <input
      type="date"
      [(ngModel)]="startDate"
      (ngModelChange)="onDateChange()"
      class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
    />
  </div>
  <div>
    <label class="block text-xs font-semibold text-slate-500 mb-1">To</label>
    <input
      type="date"
      [(ngModel)]="endDate"
      (ngModelChange)="onDateChange()"
      class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
    />
  </div>
  <button
    *ngIf="hasActiveFilters"
    (click)="clearFilters()"
    class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
  >
    Clear
  </button>
</div>
```

- Split the empty state (lines 228–278). The current block fires whenever `posts.length === 0`. Change its `*ngIf` to only cover the **no-filters, zero-posts** case:

  `*ngIf="!loading && posts.length === 0 && !errorMessage && !hasActiveFilters"`

- Add a sibling **"No posts found"** block for the filtered-but-empty case, reusing the same dashed-border container styling:

```html
<!-- No results for active filters -->
<div
  *ngIf="!loading && posts.length === 0 && !errorMessage && hasActiveFilters"
  class="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-sm"
>
  <h3 class="mt-4 text-base font-semibold text-slate-900">No posts found</h3>
  <p class="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
    No posts match your search or date filter. Try a different keyword or clear
    the filters.
  </p>
  <div class="mt-6">
    <button
      (click)="clearFilters()"
      class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
    >
      Clear filters
    </button>
  </div>
</div>
```

- The count badge (line 18, `{{ totalPosts }} … available`) already reflects `totalPosts`, which now equals the filtered `total` from the envelope — no change needed, and it correctly shows the filtered count.

---

## Edge Cases & Failure Modes

- **Empty / whitespace-only `title`:** trimmed to empty in both `getPaginatedPosts` (`backend/src/data.ts`, `filters.title?.trim()`) and the service (`filters.title?.trim()`), so it's treated as "no title filter" and the param is not sent. No results are hidden.
- **Malformed date string** (e.g. `startDate=foo`): `new Date("fooT00:00:00.000Z")` is `Invalid Date`; every `<`/`>` comparison against it is `false`, so all posts fail the date test → empty result set, no crash. Documented behaviour, enforced in `getPaginatedPosts`.
- **`startDate` after `endDate`:** no post can satisfy both bounds → empty result → "No posts found" state. This is expected, not an error.
- **Timezone:** date bounds are computed in **UTC** (`T00:00:00.000Z` / `T23:59:59.999Z`) against `createdAt` ISO strings. A user in a non-UTC zone selecting "today" may see boundary posts shift by their offset. Acceptable for this story; note it if precise local-day filtering is later required.
- **Filter reduces pages below `currentPage`:** applying a filter always resets `currentPage = 1` (in `onSearchChange`/`onDateChange`/`clearFilters`), so the user never lands on an out-of-range page. `goToPage` still guards `page > this.totalPages` (component line 108).
- **Delete last matching post on a filtered page > 1:** existing `deletePost` logic (component lines 68–70) decrements the page when the current page has one post; re-fetch uses the same active filters, so it stays consistent.
- **Combined filter with no matches vs. genuinely empty store:** `hasActiveFilters` disambiguates the two empty states — "No posts found" (filters active) vs "No posts yet" (empty store).
- **Search debounce:** the 300ms `debounceTime` on `search$` prevents a request per keystroke. Date inputs re-query immediately via `onDateChange` (discrete events, not per-keystroke).

---

## Test Plan

No automated test framework is configured in this repo (no `*.spec.ts`/`*.test.ts` files; `backend/package.json` has only `dev`/`build`/`start` scripts). Follow the existing precedent from [Story 03](03-story-pagination-and-dates.md) and verify via `curl` + manual UI checks. Setting up Jest/Karma is **out of scope** unless the user asks.

1. **Title search (API):** `curl "http://localhost:3000/api/posts?title=%2312"` → envelope contains only posts whose title includes "#12" (seed titles are `Post #N: …`); `total` reflects the filtered count.
2. **Case-insensitive title (API):** `curl "http://localhost:3000/api/posts?title=EXPLORING"` → matches the seed titles containing "Exploring" (case-insensitive).
3. **Date range (API):** pick two `createdAt` days from `curl -s http://localhost:3000/api/posts?limit=100 | jq '.data[].createdAt'`, then `curl "http://localhost:3000/api/posts?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD"` → only posts within the inclusive range; `total`/`totalPages` reflect it.
4. **Combined search + date (API):** `curl "http://localhost:3000/api/posts?title=Post&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD"` → results satisfy both conditions.
5. **No match (API):** `curl "http://localhost:3000/api/posts?title=zzznomatch"` → `{ data: [], total: 0, page: 1, totalPages: 0 }`.
6. **Malformed date (API):** `curl "http://localhost:3000/api/posts?startDate=notadate"` → `200` with `data: []`, no 500.
7. **Filtered pagination (API):** with a broad `title` that matches >10 posts, `curl "…?title=Post&page=2&limit=10"` → returns page 2 of the filtered set.
8. **UI search:** type a keyword in the search box → after ~300ms the grid shows only matching posts, page resets to 1, count badge shows the filtered total.
9. **UI date filter:** pick From/To dates → grid narrows immediately; clearing a date widens results.
10. **UI combined + empty state:** enter a keyword and a range with no overlap → "No posts found" empty state renders with a "Clear filters" button; clicking it restores the full list.
11. **UI no-filter empty state unaffected:** with filters cleared and (hypothetically) zero posts, the original "No posts yet" state still shows.

---

## Verification Steps

1. **Backend builds:** `cd backend && pnpm build` — `tsc` compiles with no errors (confirms the `PostFilters` type and updated signatures type-check). Then `pnpm dev` — server starts on port 3000.
2. **Frontend runs:** `cd frontend && pnpm start` — app compiles with no errors (confirms `FormsModule`/`ngModel` and the new template bindings), opens at `http://localhost:4200`.
3. **API contract:** `curl -s "http://localhost:3000/api/posts?title=Post" | jq .` — response still has `data`, `total`, `page`, `totalPages`; `total` reflects the filtered count.
4. **Regression:** with no filter params, `curl -s http://localhost:3000/api/posts | jq '.total'` returns 50 (unchanged from Story 03). Pagination Next/Previous, create modal, edit modal, and delete-with-confirm all still work with no console errors.

---

## Done Criteria

- [ ] `GET /api/posts?title=` returns only posts whose title contains the keyword (case-insensitive substring).
- [ ] `GET /api/posts?startDate=&endDate=` returns only posts whose `createdAt` is within the inclusive day range; `date` shorthand pins both bounds to one day.
- [ ] Title and date filters combine (AND) in one request.
- [ ] Filtering is applied **before** pagination; `total`/`totalPages` describe the filtered set.
- [ ] All filtering runs on the backend; the frontend only sends params and renders results.
- [ ] List page has a search input and From/To date inputs; changing any resets to page 1 and re-queries.
- [ ] Search input is debounced (300ms); date inputs re-query on change.
- [ ] A "No posts found" empty state shows when active filters match nothing, distinct from "No posts yet".
- [ ] A "Clear" control resets all filters and reloads the full list.
- [ ] `pnpm build` (backend) and `pnpm start` (frontend) succeed with no type or template errors.
- [ ] No new npm dependencies added.
- [ ] No sorting, body-search, or filter-persistence changes (out of scope).
- [ ] Overview `00-overview.md` updated with this story.
