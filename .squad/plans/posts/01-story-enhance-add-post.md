# Story 01 — Enhance add post: show form in a popup instead of a separate page

---

## Prerequisites

None.

---

## Story Goal

Replace the dedicated `/new` route with a modal (popup) dialog that appears on the post list page. The user clicks "New Post" in the navbar or empty-state CTA, a modal overlay appears with the create-post form, and on successful submission the modal closes and the list refreshes. The edit flow (`/edit/:id`) remains on a separate page — this story only converts the **create** flow to a popup.

**Not in scope:** converting edit to a modal, adding Angular CDK, adding a third-party dialog library, changing validation rules.

---

## Context — Read These Files First

1. `src/app/components/post-form/post-form.component.ts` — the existing form component (~lines 1–86). Note the `postId` detection from route params and the `router.navigate(['/'])` on success.
2. `src/app/components/post-form/post-form.component.html` — template (~lines 1–128). The full reactive form with validation UI.
3. `src/app/components/post-list/post-list.component.ts` — list component (~lines 1–46). Has `fetchPosts()` method and `deletePost()`.
4. `src/app/components/post-list/post-list.component.html` — list template (~lines 1–107). Contains the "New Post" empty-state link (`routerLink="/new"` on line 97).
5. `src/app/app.component.ts` — shell with navbar (~lines 1–55). Contains `routerLink="/new"` button on line 29.
6. `src/app/app.routes.ts` — routing config (~lines 1–9). `{ path: 'new', component: PostFormComponent }`.
7. `src/styles.css` — global styles (~lines 1–37). Tailwind v4 with `@import "tailwindcss"`, custom `animate-fade-in` keyframe.
8. `package.json` — dependencies (~lines 1–39). No Angular CDK, no dialog library installed.

---

## Implementation tasks

### 1 — Create a reusable modal wrapper component

**Create file: `src/app/components/modal/modal.component.ts`**

Standalone component with:
- Inputs: `isOpen: boolean` (controls visibility).
- Outputs: `closed: EventEmitter<void>` (emitted on backdrop click or close-button click).
- Template: a fixed-position backdrop (`bg-black/50`) with a centered white card. Animate in with Tailwind classes (fade + scale). Trap focus is not required for this story but leave the structure extensible.
- Close on `Escape` keydown via `@HostListener('document:keydown.escape')`.
- Use `@if (isOpen)` (Angular 20 control flow) for conditional rendering — no `*ngIf` needed.

```ts
@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    @if (isOpen) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 animate-fade-in" (click)="close()"></div>
        <div class="relative z-10 w-full max-w-2xl animate-fade-in">
          <ng-content></ng-content>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  close() { this.closed.emit(); }
}
```

---

### 2 — Refactor PostFormComponent to support embedded (non-routed) create mode

**File: `src/app/components/post-form/post-form.component.ts`**

Add:
- An `@Output() saved = new EventEmitter<void>()` — emitted after successful creation so the parent can refresh.
- An `@Output() cancelled = new EventEmitter<void>()` — emitted when Cancel is clicked in embedded mode.
- An `@Input() embedded = false` — when true, skip route-param detection in `ngOnInit` and emit outputs instead of navigating.

Modify `ngOnInit` (~line 33):
```ts
ngOnInit(): void {
  if (this.embedded) return; // skip route-based init for modal usage
  this.postId = this.route.snapshot.paramMap.get('id');
  // ... existing load logic
}
```

Modify success handler (~line 73):
```ts
next: () => {
  this.submitting = false;
  if (this.embedded) {
    this.saved.emit();
  } else {
    this.router.navigate(['/']);
  }
},
```

Add a `onCancel()` method:
```ts
onCancel(): void {
  if (this.embedded) {
    this.cancelled.emit();
  } else {
    this.router.navigate(['/']);
  }
}
```

**File: `src/app/components/post-form/post-form.component.html`**

Replace the Cancel `<a routerLink="/">` (~line 106) with:
```html
<button type="button" (click)="onCancel()" class="...same classes...">Cancel</button>
```

This keeps the Cancel button functional in both routed and embedded modes.

---

### 3 — Integrate the modal into PostListComponent

**File: `src/app/components/post-list/post-list.component.ts`**

Add:
- `showCreateModal = false;`
- Method `openCreateModal(): void { this.showCreateModal = true; }`
- Method `onPostCreated(): void { this.showCreateModal = false; this.fetchPosts(); }`
- Method `onCreateCancelled(): void { this.showCreateModal = false; }`
- Import `ModalComponent` and `PostFormComponent` in the `imports` array.

**File: `src/app/components/post-list/post-list.component.html`**

At the bottom of the template (before the closing `</div>`), add:
```html
<app-modal [isOpen]="showCreateModal" (closed)="onCreateCancelled()">
  <app-post-form [embedded]="true" (saved)="onPostCreated()" (cancelled)="onCreateCancelled()"></app-post-form>
</app-modal>
```

Replace the empty-state `<a routerLink="/new">` (~line 97) with:
```html
<button (click)="openCreateModal()" class="...same classes...">
  <!-- same SVG icon + text -->
  Write your first post
</button>
```

---

### 4 — Change navbar "New Post" button to open the modal

**File: `src/app/app.component.ts`**

The navbar "New Post" button currently uses `routerLink="/new"` (~line 29). Two approaches:

**Chosen approach:** Use Angular's router to stay on `''` route and communicate with PostListComponent via a shared signal or by emitting an event through a lightweight service.

Create a minimal service:

**Create file: `src/app/services/create-post-trigger.service.ts`**

```ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CreatePostTriggerService {
  readonly trigger$ = new Subject<void>();
  open(): void { this.trigger$.next(); }
}
```

**File: `src/app/app.component.ts`**

- Inject `CreatePostTriggerService` and `Router`.
- Replace `routerLink="/new"` on the button with `(click)="openNewPost()"`.
- In `openNewPost()`: navigate to `/` (no-op if already there), then call `this.createPostTrigger.open()`.

**File: `src/app/components/post-list/post-list.component.ts`**

- Inject `CreatePostTriggerService`.
- In `ngOnInit`, subscribe to `trigger$` and call `openCreateModal()`.
- Store subscription and unsubscribe in `ngOnDestroy`.

---

### 5 — Remove the `/new` route (optional but recommended)

**File: `src/app/app.routes.ts`**

Remove line: `{ path: 'new', component: PostFormComponent }`.

Keep `{ path: 'edit/:id', component: PostFormComponent }` — edit stays as a page.

After removal, the routes become:
```ts
export const routes: Routes = [
  { path: '', component: PostListComponent },
  { path: 'edit/:id', component: PostFormComponent },
];
```

---

## Edge Cases & Failure Modes

- **User navigates directly to `/new` (bookmarked URL):** After removing the route, this will 404 or redirect to home (depending on wildcard route). Since there is no wildcard route currently, Angular shows a blank page. Add a wildcard redirect: `{ path: '**', redirectTo: '' }` in `app.routes.ts`.
- **Form submission error while modal is open:** The error message renders inside the modal (the existing error UI in `post-form.component.html` ~line 95 handles this). Modal stays open so the user can retry.
- **User clicks backdrop during submission (`submitting = true`):** The `close()` event fires. The `onCreateCancelled()` method closes the modal and the in-flight request completes in the background. This is acceptable — the post will still be created server-side. Consider: disable backdrop close while `submitting` is true (check `PostFormComponent.submitting` via a `@ViewChild` or by adding a guard condition in the modal).
- **Escape key during form input:** Standard form behaviour — escape closes modal. The user loses unstyled input. Acceptable for MVP; a "discard changes?" prompt is out of scope.
- **Scroll lock:** When the modal is open, the body should not scroll underneath. Add `overflow: hidden` on `document.body` when modal opens, remove on close (handled inside `ModalComponent` via `Renderer2` or a class toggle).
- **Mobile viewport:** The modal uses `max-w-2xl` and `p-4` inset — on small screens the form will be near full-width. The existing form is already responsive.

---

## Test Plan

No test framework is currently configured in this project (`package.json` has no Karma/Jest). Manual testing only.

1. **Modal opens from navbar:** Click "New Post" in header → modal appears with create form.
2. **Modal opens from empty state:** Delete all posts → empty state CTA opens modal.
3. **Form validation in modal:** Submit empty form → client-side errors shown inside modal.
4. **Successful creation:** Fill valid data, submit → modal closes, new post appears in list without page reload.
5. **Cancel button:** Click Cancel → modal closes, no post created.
6. **Backdrop click:** Click dark overlay → modal closes.
7. **Escape key:** Press Escape → modal closes.
8. **Edit still works as page:** Click Edit on a post → navigates to `/edit/:id` page (not a modal).
9. **Direct `/new` URL:** Type `/new` in address bar → redirects to home (wildcard route).
10. **Server error during create:** Stop backend, submit form → error message shown inside modal, modal stays open.

---

## Verification Steps

1. **Frontend runs:** `cd frontend && pnpm start` — app compiles with no errors, opens at `http://localhost:4200`.
2. **Backend runs:** `cd backend && pnpm dev` — API available at `http://localhost:3000`.
3. **Regression:** Edit flow (`/edit/:id`) still navigates to a full page and works correctly. Delete still works with confirm dialog. List still loads on initial page load.

---

## Done Criteria

- [ ] "New Post" button in navbar opens a modal overlay (not a page navigation).
- [ ] The modal contains the create-post form with identical validation behaviour.
- [ ] Successful submission closes the modal and refreshes the post list.
- [ ] Cancel, backdrop click, and Escape all close the modal.
- [ ] Edit post still uses the `/edit/:id` page route.
- [ ] The `/new` route is removed; direct navigation to it redirects to home.
- [ ] No new npm dependencies added.
