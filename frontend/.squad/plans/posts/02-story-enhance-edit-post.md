# Story 02 — Enhance edit post: show form in a popup instead of a separate page

---

## Prerequisites

- Story 01 completed: create-post modal, `ModalComponent`, `PostFormComponent` embedded mode, `CreatePostTriggerService`.

---

## Story Goal

Replace the dedicated `/edit/:id` route with a modal (popup) dialog that appears on the post list page. The user clicks "Edit" on a post card, a modal overlay appears with the edit form pre-filled with the post's data, and on successful update the modal closes and the list refreshes. The create flow remains as-is (already a modal from Story 01).

**Not in scope:** adding Angular CDK, adding a third-party dialog library, changing validation rules, adding unsaved-changes confirmation.

---

## Context — Read These Files First

1. `src/app/components/post-form/post-form.component.ts` — the form component (~lines 1–106). Note `@Input() embedded = false` on line 14, `postId` field on line 22, route-param skipping on line 36 (`if (this.embedded) return;`), success handler branching on line 82–86, `onCancel()` on lines 99–105.
2. `src/app/components/post-form/post-form.component.html` — template (~lines 1–206). Header shows `postId ? "Edit Post" : "Create New Post"` on line 33. Submit button text is `"Publish Post"` on line 202 — does not change for edit mode.
3. `src/app/components/post-list/post-list.component.ts` — list component (~lines 1–75). Has `showCreateModal`, `openCreateModal()`, `onPostCreated()`, `onCreateCancelled()`. Imports `ModalComponent` and `PostFormComponent` already.
4. `src/app/components/post-list/post-list.component.html` — list template (~lines 1–216). Edit button is `<a [routerLink]="['/edit', post.id]">` on lines 110–129. Create modal at bottom, lines 210–216.
5. `src/app/components/modal/modal.component.ts` — reusable modal (~lines 1–44). `@Input() isOpen`, `@Output() closed`, Escape key handling.
6. `src/app/app.routes.ts` — routing (~lines 1–9). `{ path: 'edit/:id', component: PostFormComponent }` on line 7.
7. `src/app/services/post.service.ts` — `getOne(id)` on line 17, `update(id, input)` on line 24.

---

## Implementation tasks

### 1 — Add `postId` input to PostFormComponent for embedded edit mode

**File: `src/app/components/post-form/post-form.component.ts`**

Currently, when `embedded` is `true`, `ngOnInit` returns early (line 36) and never sets `postId`. The component needs to accept a post ID from outside when used in embedded mode.

Add a new `@Input()`:

```ts
@Input() editPostId: string | null = null;
```

Modify `ngOnInit` (~line 35) to load the post when `editPostId` is provided in embedded mode:

```ts
ngOnInit(): void {
  if (this.embedded) {
    if (this.editPostId) {
      this.postId = this.editPostId;
      this.loading = true;
      this.postService.getOne(this.editPostId).subscribe({
        next: (post) => {
          this.form.patchValue({ title: post.title, body: post.body });
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'Failed to load post.';
          this.loading = false;
        },
      });
    }
    return;
  }
  this.postId = this.route.snapshot.paramMap.get('id');
  // ... existing route-based load logic unchanged
}
```

Also add `OnChanges` to handle the case where the parent changes `editPostId` while the component is alive (e.g., user clicks Edit on a different post without closing the modal):

```ts
export class PostFormComponent implements OnInit, OnChanges {
  // ...
  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes["editPostId"] &&
      this.embedded &&
      !changes["editPostId"].firstChange
    ) {
      this.resetForm();
      this.ngOnInit();
    }
  }

  private resetForm(): void {
    this.form.reset();
    this.serverErrors = {};
    this.errorMessage = "";
    this.submitting = false;
  }
}
```

Add imports for `OnChanges` and `SimpleChanges` from `@angular/core`.

**File: `src/app/components/post-form/post-form.component.html`**

Update the submit button text on line 202 to show "Update Post" when editing:

```html
<span
  >{{ submitting ? 'Saving...' : (postId ? 'Update Post' : 'Publish Post')
  }}</span
>
```

---

### 2 — Add edit modal state and methods to PostListComponent

**File: `src/app/components/post-list/post-list.component.ts`**

Add new properties alongside the existing `showCreateModal` (after line 21):

```ts
showEditModal = false;
editingPostId: string | null = null;
```

Add new methods:

```ts
openEditModal(postId: string): void {
  this.editingPostId = postId;
  this.showEditModal = true;
}

onPostUpdated(): void {
  this.showEditModal = false;
  this.editingPostId = null;
  this.fetchPosts();
}

onEditCancelled(): void {
  this.showEditModal = false;
  this.editingPostId = null;
}
```

---

### 3 — Replace edit routerLink with modal trigger in the list template

**File: `src/app/components/post-list/post-list.component.html`**

Replace the `<a [routerLink]="['/edit', post.id]">` edit button (lines 110–129) with a `<button>` that opens the edit modal:

```html
<button
  (click)="openEditModal(post.id)"
  class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
>
  <!-- same pencil SVG icon -->
  Edit
</button>
```

Add the edit modal at the bottom of the template, after the existing create modal (after line 216):

```html
<app-modal [isOpen]="showEditModal" (closed)="onEditCancelled()">
  <app-post-form
    [embedded]="true"
    [editPostId]="editingPostId"
    (saved)="onPostUpdated()"
    (cancelled)="onEditCancelled()"
  ></app-post-form>
</app-modal>
```

---

### 4 — Remove the `/edit/:id` route

**File: `src/app/app.routes.ts`**

Remove line 7: `{ path: 'edit/:id', component: PostFormComponent }`.

After removal:

```ts
export const routes: Routes = [
  { path: "", component: PostListComponent },
  { path: "**", redirectTo: "" },
];
```

The `PostFormComponent` import on line 3 is no longer needed in this file — remove it.

---

### 5 — Remove RouterLink import from PostListComponent (if no longer used)

**File: `src/app/components/post-list/post-list.component.ts`**

After removing the edit `routerLink` from the template, check if `RouterLink` is still used in `post-list.component.html`. Currently it is only used by the edit `<a>` tag. Remove `RouterLink` from the `imports` array (line 14) and the import statement (line 3).

---

### 6 — No backend changes required

The backend API contract is unchanged. `PUT /api/posts/:id` continues to work as before.

---

## Edge Cases & Failure Modes

- **User navigates directly to `/edit/:id` (bookmarked URL):** After removing the route, the wildcard `{ path: '**', redirectTo: '' }` (line 8 of `app.routes.ts`) catches it and redirects to the post list. No blank page.
- **Post loading error in modal:** If `getOne(id)` fails (post deleted or backend down), the existing error handling in `PostFormComponent.ngOnInit` sets `this.errorMessage = 'Failed to load post.'` — this renders inside the modal. The modal stays open so the user can close it manually.
- **User clicks Edit on a different post while edit modal is open:** The `OnChanges` hook on `editPostId` resets the form and re-loads the new post. This prevents stale data from post A appearing while editing post B.
- **Concurrent create and edit modals:** `showCreateModal` and `showEditModal` are independent booleans. If both are true, two modals stack. This is unlikely since the list buttons are hidden behind the modal backdrop. No guard needed for MVP.
- **Form submission error while modal is open:** The error renders inside the modal via the existing error UI (`post-form.component.html` line 141–160). Modal stays open for retry.
- **Escape key or backdrop click during edit:** Closes the modal. Unstyled edits are lost. Acceptable for MVP (same as create flow in Story 01).
- **Delete a post then click Edit on the same post (race condition):** The `deletePost()` method fetches the list after deletion. The deleted post card disappears before the user can click Edit. If timing allows it, `getOne()` returns 404, which triggers the error handler and shows "Failed to load post." in the modal.

---

## Test Plan

No test framework is currently configured (`package.json` has no Karma/Jest). Manual testing only.

1. **Edit modal opens from card:** Click "Edit" on a post card → modal appears with form pre-filled with the post's title and body.
2. **Form pre-fill is correct:** Verify title and body match the post that was clicked.
3. **Successful update:** Edit title or body, submit → modal closes, updated post appears in the list without page reload.
4. **Validation in modal:** Clear the title, submit → client-side error "Title is required." shown inside modal.
5. **Cancel button:** Click Cancel → modal closes, post unchanged.
6. **Backdrop click:** Click dark overlay → modal closes.
7. **Escape key:** Press Escape → modal closes.
8. **Create still works as modal:** Click "New Post" → create modal opens, form is empty, creation works.
9. **Direct `/edit/123` URL:** Type `/edit/123` in address bar → redirects to home.
10. **Server error during update:** Stop backend, submit edit form → error message shown inside modal, modal stays open.
11. **Edit different post without closing:** If modal is somehow still open and a different edit is triggered, verify the form reloads with the new post data.

---

## Verification Steps

1. **Frontend runs:** `cd frontend && pnpm start` — app compiles with no errors, opens at `http://localhost:4200`.
2. **Backend runs:** `cd backend && pnpm dev` — API available at `http://localhost:3000`.
3. **Regression:** Create flow (New Post modal) still works. Delete still works with confirm dialog. List loads on initial page load. No console errors.

---

## Done Criteria

- [ ] "Edit" button on each post card opens a modal overlay (not a page navigation).
- [ ] The modal contains the edit form pre-filled with the post's current title and body.
- [ ] Successful update closes the modal and refreshes the post list.
- [ ] Cancel, backdrop click, and Escape all close the modal.
- [ ] Create post still uses the modal from Story 01.
- [ ] The `/edit/:id` route is removed; direct navigation to it redirects to home.
- [ ] Submit button shows "Update Post" (not "Publish Post") when editing.
- [ ] No new npm dependencies added.
- [ ] Overview `00-overview.md` updated with this story.
