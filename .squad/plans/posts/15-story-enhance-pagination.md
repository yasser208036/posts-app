# Story 15 — Enhance pagination: infinite scroll, remove post count badge

---

## Prerequisites

- [Story 13 completed](13-story-comment-edit-delete-replies.md): `PostListComponent` is the unified feed with inline comments, reply/edit/delete, and sticky sidebars. This story modifies only the list's scroll/pagination behaviour and the header badge — no comment or sidebar code changes.

---

## Story Goal

Three user-visible changes to `PostListComponent`:

1. **Infinite scroll** — replace the Previous/Next page buttons with automatic load-on-scroll: when the user scrolls to the bottom of the list, the next page appends silently.
2. **Newest first** — already implemented (`orderBy: { createdAt: "desc" }` in `backend/src/data.ts` line 93). No backend change needed.
3. **Remove the "posts available" count badge** — the `{{ totalPosts }} posts available` chip in the header is removed.

**Not in scope:** changing page size, changing the backend API contract, changing filter/search behaviour, or modifying comment/sidebar code.

---

## Context — Read These Files First

1. `frontend/src/app/components/post-list/post-list.component.ts` — **read whole (438 lines)**. Pagination state at lines 29–31 (`currentPage`, `totalPages`, `totalPosts`). `fetchPosts` at lines 104–127. `goToPage`/`nextPage`/`prevPage` at lines 172–184. `ngOnInit` at lines 67–93, `ngOnDestroy` at lines 95–97. Imports at line 1.
2. `frontend/src/app/components/post-list/post-list.component.html` — **lines 15–19** (the "posts available" badge `<div>`). **Lines 266–319** (the `<nav>` pagination block with Previous/Next buttons and "Page X of Y"). **Lines 115–264** (the posts grid — the scroll sentinel goes after line 264).
3. `backend/src/data.ts` — **line 93** (`orderBy: { createdAt: "desc" }`). Confirm it is already `"desc"` — no change needed.

---

## Frontend Tasks

### 1 — Component: add infinite-scroll state and methods

**File: `frontend/src/app/components/post-list/post-list.component.ts`**

**Imports** — add `AfterViewInit`, `ViewChild`, `ElementRef` to the Angular core import (line 1):

```ts
import { Component, OnDestroy, OnInit, AfterViewInit, ViewChild, ElementRef } from "@angular/core";
```

**Class declaration** — add `AfterViewInit` to the `implements` list (line 22):

```ts
export class PostListComponent implements OnInit, AfterViewInit, OnDestroy {
```

**State** — add two fields after `pageSize = 10` (line 32) and add the sentinel `@ViewChild`:

```ts
loadingMore = false;
private observer?: IntersectionObserver;

@ViewChild("scrollSentinel") private sentinel!: ElementRef;
```

**`hasMore` getter** — add after `hasActiveFilters` (line 211):

```ts
get hasMore(): boolean {
  return this.currentPage < this.totalPages;
}
```

**`fetchPosts`** — change signature to accept a `reset` flag (default `true`). When `reset` is true the list clears and page resets to 1; when false the next page appends. Replace lines 104–127:

```ts
fetchPosts(reset = true): void {
  if (reset) {
    this.currentPage = 1;
    this.posts = [];
    this.loading = true;
  } else {
    this.loadingMore = true;
  }
  this.errorMessage = "";
  this.postService
    .getAll(this.currentPage, this.pageSize, {
      title: this.searchTerm,
      startDate: this.startDate,
      endDate: this.endDate,
    })
    .subscribe({
      next: (response) => {
        this.posts = reset
          ? response.data
          : [...this.posts, ...response.data];
        this.totalPosts = response.total;
        this.totalPages = response.totalPages;
        this.currentPage = response.page;
        this.loading = false;
        this.loadingMore = false;
      },
      error: (err) => {
        this.errorMessage =
          err.error?.message || "Failed to load posts. Please try again.";
        this.loading = false;
        this.loadingMore = false;
      },
    });
}
```

**`loadMore`** — add after `fetchPosts`:

```ts
loadMore(): void {
  if (this.loadingMore || this.loading || !this.hasMore) return;
  this.currentPage++;
  this.fetchPosts(false);
}
```

**`ngAfterViewInit`** — add after `ngOnInit`:

```ts
ngAfterViewInit(): void {
  this.observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) this.loadMore();
    },
    { threshold: 0.1 },
  );
  this.observer.observe(this.sentinel.nativeElement);
}
```

**`ngOnDestroy`** — add `this.observer?.disconnect();` before `this.sub?.unsubscribe()` (line 96).

**Remove `goToPage`, `nextPage`, `prevPage`** (lines 172–184) — these are no longer called from the template.

### 2 — Template: remove badge, remove pagination nav, add sentinel

**File: `frontend/src/app/components/post-list/post-list.component.html`**

**Remove the "posts available" badge** — delete lines 15–19 (the `<div class="text-xs font-semibold ...">{{ totalPosts }} ...` block).

**Remove the pagination `<nav>`** — delete lines 266–319 (the entire `<!-- Pagination -->` block through the closing `</nav>`).

**Add scroll sentinel and loading-more spinner** — insert after the closing `</div>` of the posts grid (currently line 264, shifts after the badge removal):

```html
<!-- Infinite-scroll sentinel: observed by IntersectionObserver -->
<div #scrollSentinel class="h-1"></div>

<!-- Loading-more indicator -->
<div *ngIf="loadingMore" class="flex justify-center py-4">
  <svg
    class="h-6 w-6 animate-spin text-indigo-500"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      class="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      stroke-width="4"
    ></circle>
    <path
      class="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v8H4z"
    ></path>
  </svg>
</div>
```

---

## Edge Cases & Failure Modes

- **Filter/search change while scrolling** — `search$.pipe(debounceTime(500))` calls `fetchPosts()` (reset=true), which clears `this.posts` and resets `currentPage = 1`. Any in-flight `loadMore` call is harmless: its response appends to the now-empty array, but the next reset call overwrites it. The `loadingMore` guard prevents double-firing.
- **Rapid scroll to bottom before first page loads** — `loadMore` checks `this.loading` and returns early; the observer fires again once the sentinel re-enters the viewport after the first page renders.
- **All posts fit on one page** — `hasMore` is `false` (`currentPage === totalPages`); the observer fires but `loadMore` returns immediately. No extra request.
- **`openCommentTarget` resets the list** — it sets `this.posts = postsPage.data` directly (lines 262–265 of the component) and `this.currentPage = postsPage.page`, bypassing `fetchPosts`. This is correct: notification navigation always resets to find the target post. The sentinel remains in the DOM and will trigger `loadMore` if the user scrolls after navigation.
- **`deletePost` / `onPostCreated` / `onPostUpdated`** — all call `fetchPosts()` (no arg → reset=true), which clears and reloads from page 1. Correct.
- **`friendEvents.accepted$`** — calls `fetchPosts()` (reset=true). Correct.
- **`totalPosts` field** — still populated by `fetchPosts` for internal tracking (e.g. `deletePost` uses `this.posts.length === 1 && this.currentPage > 1`). Removing the badge does not remove the field.
- **`goToPage`/`nextPage`/`prevPage` removal** — these are only called from the pagination `<nav>` being removed. No other template or code references them. Safe to delete.

---

## Test Plan

No test runner is configured on either side (`CLAUDE.md`: "no test suite on either side"). Verify by build + manual:

1. `cd frontend && pnpm build` — confirm no TypeScript errors (removed methods, new `@ViewChild`, `AfterViewInit`).
2. Manual — load the app with more than 10 posts across two accounts (own + friends):
   - Page loads showing the first 10 posts, newest first.
   - Scroll to the bottom → next 10 posts append without a page reload.
   - Apply a title filter → list resets to page 1 with filtered results; scrolling appends filtered pages.
   - Clear filters → list resets to unfiltered page 1.
   - The "posts available" badge is gone from the header.
   - Previous/Next buttons are gone.
3. Regression: create/edit modal, comment thread, reply/edit/delete, sticky sidebars, notifications, and login/signup all still work.

---

## Verification Steps

1. **Frontend builds:** `cd frontend && pnpm build` — zero TypeScript errors.
2. **Backend unchanged:** `cd backend && pnpm build` — no changes; should be clean.
3. **Manual (two friended accounts A & B, 15+ posts total):**
   - Open `/` → first 10 posts visible, newest first, no count badge, no pagination buttons.
   - Scroll to bottom → posts 11–15 append; spinner shows briefly.
   - Type in the search box → list resets; scrolling appends filtered results.
   - Delete a post → list resets from page 1.
   - Create a post via "New Post" modal → list resets; new post appears at top.
4. **Regression:** comment expand/collapse, reply, edit, delete, sticky sidebars, notification navigation, friend request flow all unaffected.

---

## Done Criteria

- [ ] Scrolling to the bottom of the post list loads and appends the next page automatically.
- [ ] No Previous/Next pagination buttons or "Page X of Y" text in the UI.
- [ ] The "posts available" count badge is removed from the header.
- [ ] Posts are ordered newest first (already enforced by `orderBy: { createdAt: "desc" }` — verify visually).
- [ ] Filter/search changes reset the list to page 1 and re-enable scroll-loading.
- [ ] `pnpm build` (frontend) passes with no TypeScript errors.

**STOP HERE. Report to the user and wait for confirmation.**
