# Story 11 — Unified Authentication Page (Login & Sign Up)

---

## Prerequisites

- [Story 05 completed](../posts/05-story-authentication.md): `LoginComponent`, `SignupComponent`, `AuthService`, `authGuard`, and the Google Identity Services flow this story reorganizes. **No auth behaviour changes** — this story is a **frontend layout/UX refactor only**.
- Follow-up stories (`../users/08-story-online-and-friends-sidebars.md`, `../users/09-story-header-notifications.md`) added the `isAuthPage` flag and sidebars/notifications to `app.component.ts`. This story extends that same flag to fully hide the shell on the auth route — coordinate with anyone editing `frontend/src/app/app.component.ts`.
- **No backend changes.** `/api/auth/*` stays exactly as-is.

---

## Story Goal

Replace the two standalone routes `/login` and `/signup` with a **single full-screen authentication page** at `/auth` that:

1. **Removes the app shell** (navbar, sidebars, footer) and renders **full-screen** on the auth route.
2. **Merges Login and Sign Up** into one page where **only one form is visible at a time**.
3. **Toggles between forms** via tabs/buttons with **no page reload** (property toggle + `*ngIf`, not navigation) and a smooth fade animation.
4. **Split-screen layout** — a **form panel** (left) and a **branding panel** (right: logo, title, short description, distinct gradient background, centered).
5. **Responsive** — on `< lg` screens the branding panel is hidden and the form panel fills the width.

**Not in scope:** any change to `AuthService`, backend endpoints, validation rules, the Google sign-in mechanics (`utils/google-auth.ts`), password reset / "remember me" / "forgot password" (the screenshot shows these but they are **not** in the acceptance criteria — do **not** implement them). The existing `LoginComponent`/`SignupComponent` forms are **reused**, not rewritten.

---

## Product rules (from story)

| Behaviour | Current | New |
|---|---|---|
| Auth routes | Separate `/login` and `/signup` pages | **Single `/auth` route**; `/login` + `/signup` **redirect** to `/auth` |
| App shell on auth pages | Header still rendered; sidebars/new-post hidden via `isAuthPage` | **Entire shell hidden** — full-screen auth page |
| Switching login ⇄ signup | `router.navigate(['/signup'])` / `['/login']` (full navigation) | **In-place toggle** (`mode` property + `*ngIf`), **no reload** |
| Layout | Centered card inside main grid | **Split screen**: form panel + branding panel |
| Small screens | Card centered, shell visible | **Form only**, branding hidden |

> **Layout orientation:** the intake text labels branding as the "Right Section" and the form as the "Left Section"; the attachment `attachments/Screenshot from 2026-07-21 10-01-09.png` confirms **form on the left, branding on the right**. Build it that way.

---

## Context — Read These Files First

1. `frontend/src/app/app.routes.ts` — **all 14 lines**. Current routes: `''`+`feed` guarded, `login`→`LoginComponent`, `signup`→`SignupComponent`, `**`→`''`. You will add `auth`→`AuthPageComponent` and convert `login`/`signup` to redirects.
2. `frontend/src/app/app.component.ts` — **lines 28–169** (template) and **lines 171–202** (class). The whole shell (`<header>` 31–141, `<main>` 144–158, `<footer>` 161–167) is always rendered. `isAuthPage` (**lines 173, 183–191**) currently only toggles *parts* of the navbar/sidebars. `logout()` (**lines 198–201**) navigates to `/login`. Reuse the brand logo SVG (**lines 45–58**) for the branding panel.
3. `frontend/src/app/guards/auth.guard.ts` — **line 8**, `router.createUrlTree(["/login"])`. Redirect target becomes `/auth`.
4. `frontend/src/app/components/login/login.component.ts` — **lines 19–34** (form + deps), **lines 36–62** (`ngAfterViewInit` Google init), **lines 109–111** (`navigateToSignup`). Add a `switchMode` output; repoint the switch action to emit instead of navigating.
5. `frontend/src/app/components/login/login.component.html` — **line 1** (`animate-fade-in max-w-md mx-auto` wrapper), **lines 2–6** (card `<form>` chrome), **lines 124–130** (bottom "Sign up" switch button), **lines 141–143** (`<div id="googleBtn">`). Strip the card chrome so the form sits cleanly in the panel; repoint the switch button.
6. `frontend/src/app/components/signup/signup.component.ts` — **lines 18–34**, **lines 120–122** (`navigateToLogin`). Same treatment as login.
7. `frontend/src/app/components/signup/signup.component.html` — **line 1** wrapper, **lines 2–6** card `<form>`, **lines 166–168** `<div id="googleBtn">`, **lines 173–179** bottom "Login" switch button.
8. `frontend/src/app/utils/google-auth.ts` — **lines 48–86**, especially **line 71** `document.getElementById("googleBtn")`. **Critical:** both templates use the same element id `googleBtn`. This is safe **only because one form is in the DOM at a time** — you **must** use `*ngIf` (not `[hidden]`/CSS) to switch forms so there is never a duplicate `googleBtn`.
9. `frontend/src/styles.css` — **lines 24–37**. The existing `.animate-fade-in` / `@keyframes fadeIn` is the toggle animation; the form components already carry `animate-fade-in` on their root, so recreating them via `*ngIf` retriggers it. No new CSS required.
10. Attachment: `.squad/stories/log-in-page/enhance-log-in-page/attachments/Screenshot from 2026-07-21 10-01-09.png` — target visual (form left, gradient branding right).
11. Precedent for a standalone reactive-form component with Tailwind chrome: the login/signup components themselves (files 4–7) — match their class conventions in the new `AuthPageComponent`.

---

## Frontend Tasks

### 1 — Let the form components emit a mode switch instead of navigating

**File: `frontend/src/app/components/login/login.component.ts`**

- Add to the `@angular/core` import (**line 1**): `EventEmitter`, `Output`.
- Add an output on the class:

```ts
@Output() switchMode = new EventEmitter<void>();
```

- Change `navigateToSignup()` (**lines 109–111**) to emit instead of navigating:

```ts
switchToSignup(): void {
  this.switchMode.emit();
}
```

  Rename the method (and its template binding) or keep the name — just make the body `this.switchMode.emit();`. **Do not** change `onSubmit()`'s success `this.router.navigate(["/"])` (**line 94**) — after a successful login the user still goes to the post list.

**File: `frontend/src/app/components/signup/signup.component.ts`** — mirror exactly: add `Output`/`EventEmitter` (**line 1**), add `@Output() switchMode = new EventEmitter<void>();`, and change `navigateToLogin()` (**lines 120–122**) to `this.switchMode.emit();`. Leave the success `this.router.navigate(["/"])` (**line 95**) unchanged.

---

### 2 — Strip the card chrome and repoint the switch buttons in the form templates

**File: `frontend/src/app/components/login/login.component.html`**

- **Line 1:** change the wrapper `class="animate-fade-in max-w-md mx-auto"` → `class="animate-fade-in"` (the `AuthPageComponent` panel owns width/centering).
- **Lines 2–6:** remove the card chrome from `<form>` — drop `rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm` (keep `[formGroup]`, `(ngSubmit)`). The panel background is already white.
- **Lines 124–130:** the bottom "Sign up" `<button>` currently calls `(click)="navigateToSignup()"`. Repoint it to the new emitter (`(click)="switchToSignup()"`). Optionally simplify it to a text link matching the screenshot's "Don't have an account? Sign Up!" — keep it a `type="button"` so it never submits.

**File: `frontend/src/app/components/signup/signup.component.html`** — mirror: **line 1** wrapper → `class="animate-fade-in"`; **lines 2–6** remove the same card chrome from `<form>`; **lines 173–179** repoint the "Login" button `(click)` to the signup component's switch emitter.

> Leave both `<div id="googleBtn"></div>` blocks (login **141–143**, signup **166–168**) and all field/error markup **unchanged**.

---

### 3 — Create the unified auth page

**Create file: `frontend/src/app/components/auth-page/auth-page.component.ts`**

```ts
import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LoginComponent } from "../login/login.component";
import { SignupComponent } from "../signup/signup.component";

type AuthMode = "login" | "signup";

@Component({
  selector: "app-auth-page",
  standalone: true,
  imports: [CommonModule, LoginComponent, SignupComponent],
  templateUrl: "./auth-page.component.html",
})
export class AuthPageComponent {
  mode: AuthMode = "login";

  setMode(mode: AuthMode): void {
    this.mode = mode;
  }
}
```

**Create file: `frontend/src/app/components/auth-page/auth-page.component.html`** — full-screen split layout. Match the existing Tailwind vocabulary (indigo/violet brand, `rounded-xl`, `slate` text). Structure:

```html
<div class="flex min-h-screen">
  <!-- Form panel (left) -->
  <div
    class="flex w-full lg:w-1/2 flex-col justify-center px-6 py-10 sm:px-12 lg:px-20 bg-white"
  >
    <div class="mx-auto w-full max-w-md">
      <!-- Brand mark (reuse the navbar logo SVG from app.component.ts lines 42-69) -->
      <div class="mb-8 flex items-center gap-2.5">
        <!-- <div class="flex h-10 w-10 ... bg-linear-to-br from-indigo-500 to-violet-600 ...">SVG</div> -->
        <span class="text-lg font-bold tracking-tight text-slate-900">PostsHub</span>
      </div>

      <!-- Toggle tabs — no reload, just mode switch -->
      <div class="mb-6 inline-flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          (click)="setMode('login')"
          [class.bg-white]="mode === 'login'"
          [class.text-indigo-600]="mode === 'login'"
          [class.shadow-sm]="mode === 'login'"
          class="rounded-lg px-5 py-2 text-sm font-semibold text-slate-600 transition-all"
        >
          Login
        </button>
        <button
          type="button"
          (click)="setMode('signup')"
          [class.bg-white]="mode === 'signup'"
          [class.text-indigo-600]="mode === 'signup'"
          [class.shadow-sm]="mode === 'signup'"
          class="rounded-lg px-5 py-2 text-sm font-semibold text-slate-600 transition-all"
        >
          Sign up
        </button>
      </div>

      <!-- Exactly one form in the DOM at a time (*ngIf, NOT [hidden]) -->
      <app-login
        *ngIf="mode === 'login'"
        (switchMode)="setMode('signup')"
      ></app-login>
      <app-signup
        *ngIf="mode === 'signup'"
        (switchMode)="setMode('login')"
      ></app-signup>
    </div>
  </div>

  <!-- Branding panel (right) — hidden below lg -->
  <div
    class="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-linear-to-br from-indigo-500 via-violet-600 to-indigo-700 px-12 text-center text-white"
  >
    <!-- Reuse the brand logo SVG, larger -->
    <h1 class="mt-6 text-3xl font-bold tracking-tight">PostsHub</h1>
    <p class="mt-3 max-w-sm text-sm text-indigo-100">
      Share your thoughts, connect with friends, and follow the conversations
      that matter to you.
    </p>
  </div>
</div>
```

- **Only one form is mounted at a time** via `*ngIf` → only one `id="googleBtn"` ever exists → Google init in each component's `ngAfterViewInit` (login **36–62**, signup **36–60**) works unchanged, and the child's `ngOnDestroy` cleanup runs on toggle.
- The fade animation comes free: each form root carries `animate-fade-in` (templates **line 1**), which retriggers because `*ngIf` recreates the element on every toggle.

---

### 4 — Route to the unified page

**File: `frontend/src/app/app.routes.ts`** — import `AuthPageComponent`, add the `auth` route, and convert `login`/`signup` to redirects (keeps any existing bookmarks/links working):

```ts
import { AuthPageComponent } from "./components/auth-page/auth-page.component";

export const routes: Routes = [
  { path: "", component: PostListComponent, canActivate: [authGuard] },
  { path: "feed", component: FeedComponent, canActivate: [authGuard] },
  { path: "auth", component: AuthPageComponent },
  { path: "login", redirectTo: "auth", pathMatch: "full" },
  { path: "signup", redirectTo: "auth", pathMatch: "full" },
  { path: "**", redirectTo: "" },
];
```

The `LoginComponent`/`SignupComponent` imports on **lines 5–6** are still needed (they are used by `AuthPageComponent`, not the router) — leave them or remove them from `app.routes.ts` since they are no longer referenced there. **Remove the two now-unused router imports** to keep the file clean; the components are imported by `auth-page.component.ts`.

---

### 5 — Hide the app shell on the auth route (full-screen)

**File: `frontend/src/app/guards/auth.guard.ts`** — **line 8**: change `router.createUrlTree(["/login"])` → `router.createUrlTree(["/auth"])`.

**File: `frontend/src/app/app.component.ts`**

- **Template (lines 28–169):** wrap the entire shell so it renders only off the auth route, and render a bare outlet on it. Replace the outer `<div class="min-h-screen flex flex-col bg-slate-50"> … </div>` with:

```html
<router-outlet *ngIf="isAuthPage"></router-outlet>

<div *ngIf="!isAuthPage" class="min-h-screen flex flex-col bg-slate-50">
  <!-- existing header (31–141), main (144–158), footer (161–167) unchanged -->
</div>
```

  This removes the navbar **and** footer **and** sidebars on `/auth`, giving the full-screen layout the AC requires. (The inner `*ngIf="!isAuthPage"` guards on the New-Post button, notifications, and sidebars become redundant but are harmless — leave them.)

- **`isAuthPage` detection (lines 183–191):** extend the match to `/auth` (and keep `/login`, `/signup` for the redirect frame so there is no shell flash mid-redirect):

```ts
const isAuth = (u: string) =>
  u.startsWith("/auth") || u.startsWith("/login") || u.startsWith("/signup");
// initial:
this.isAuthPage = isAuth(this.router.url);
// in NavigationEnd handler:
this.isAuthPage = isAuth(url);
```

- **`logout()` (lines 198–201):** change `this.router.navigate(["/login"])` → `this.router.navigate(["/auth"])`.
- **Navbar auth links (lines 124–137):** the `#authLinks` "Login"/"Sign up" `routerLink="/login"` / `routerLink="/signup"` still resolve via the redirects, but repoint both to `routerLink="/auth"` for directness. (These render only on non-auth pages, so they mainly matter right after logout.)

---

## Edge Cases & Failure Modes

- **Duplicate `googleBtn` id** — if a future edit switches forms with `[hidden]`/CSS instead of `*ngIf`, both `<div id="googleBtn">` (login `login.component.html` 141–143, signup `signup.component.html` 166–168) live in the DOM and `document.getElementById("googleBtn")` (`utils/google-auth.ts` line 71) binds the button to the wrong/first one. **Enforcement:** `AuthPageComponent` template uses `*ngIf` on `<app-login>`/`<app-signup>` (Task 3). Keep it that way.
- **Toggle must not reload** — switching tabs sets the `mode` property only (`setMode`, Task 3); it never calls `router.navigate`. The bottom in-form switch buttons now emit `switchMode` (Task 1) rather than navigating. Verify the browser URL stays `/auth` and no network document request fires when toggling.
- **Google init on every toggle** — each toggle destroys one form and creates the other, so `ngAfterViewInit` re-runs `initializeGoogleSignIn` and `ngOnDestroy` runs the child's `cleanupGis`. This is expected; `google.accounts.id.initialize` is idempotent per call. If the GIS script is slow, the button may pop in a moment after the form — acceptable, matches current behaviour.
- **`googleClientId` placeholder** — unchanged from Story 05: `isGoogleClientIdPlaceholder()` (`utils/google-auth.ts` 10–15) short-circuits and the login form shows its existing placeholder error. Not re-tested here.
- **Deep link `/login` or `/signup`** — both `redirectTo: "auth"` (Task 4) and land in the **default `login` mode**. Preserving "arrive on the signup tab" from a `/signup` link is **out of scope**; the branding/tabs let the user switch in one click. Do **not** add query-param mode plumbing unless asked.
- **Full-screen frame during redirect** — because `isAuthPage` also matches `/login` and `/signup` (Task 5), the shell does not flash for the redirect tick before `/auth` resolves.
- **Authenticated user visits `/auth`** — there is **no** guard on `/auth` (same as the old `/login`/`/signup`); a logged-in user can still open it. This is **unchanged** existing behaviour; do not add a "redirect authenticated users home" guard in this story.
- **Small-screen branding** — the branding panel uses `hidden lg:flex`; on `< lg` the form panel is `w-full`. Verify at 375px and 768px widths that no branding is visible and the form is full-width.

---

## Test Plan

No test runner is configured on the frontend (`CLAUDE.md`: "There is no test suite or linter configured"). Verify manually with the app running (`cd frontend && pnpm start`). Manual matrix:

1. **Full-screen** — visit `/auth`: no navbar, no footer, no sidebars; split layout renders (form left, gradient branding right on ≥ lg).
2. **Toggle** — click **Sign up** then **Login**: the visible form swaps with a fade, the URL stays `/auth`, and **no page reload** occurs (Network tab shows no new document request). The in-form switch link does the same.
3. **One Google button** — inspect the DOM in each mode: exactly one `#googleBtn` element exists; the Google button renders in both modes.
4. **Login happy path** — valid credentials → redirect to `/` (post list, shell visible again). Wrong password → "Invalid credentials" inline (unchanged).
5. **Signup happy path** — valid name/email/password → redirect to `/`. Duplicate email → `errors.email` inline (unchanged).
6. **Redirects** — visit `/login` and `/signup` directly → both land on `/auth` (login mode).
7. **Guard** — while logged out, visit `/` → redirected to `/auth`. Log in → `/` renders with the shell. **Logout** from the navbar → returns to `/auth` and clears `localStorage` (unchanged `AuthService.logout`).
8. **Responsive** — at 375px and 768px: branding hidden, form fills width; at ≥ 1024px: both panels visible.

---

## Verification Steps

1. **Frontend builds:** `cd frontend && pnpm build` — Angular strict compile passes (new `AuthPageComponent`, the `@Output() switchMode` on both form components, and the `app.component.ts` template restructure all typecheck).
2. **Frontend runs:** `cd frontend && pnpm start` — opens at `http://localhost:4200`; logged out lands on `/auth` full-screen.
3. **Backend unchanged:** no backend build needed. If exercising end-to-end, `cd backend && pnpm dev` and confirm login/signup/Google still return `AuthResponse` (no contract change).
4. **Regression:** after logging in, post list + `/feed` + New-Post modal + sidebars + notifications all render with the shell exactly as before (Story 08–10 behaviour intact).

---

## Done Criteria

- [ ] The navbar (and footer/sidebars) are **not** visible on the auth page; it renders **full-screen**.
- [ ] A single route `/auth` hosts both forms; `/login` and `/signup` redirect to it.
- [ ] **Only one** form (Login **or** Sign Up) is visible at a time.
- [ ] Login/Sign up tabs (and the in-form switch link) toggle the form **without a page reload**, with a fade animation.
- [ ] Split-screen: form panel (left) + branding panel (right) with logo, title, short description, centered on a distinct gradient background.
- [ ] On `< lg` screens the branding panel is hidden and the form panel fills the width.
- [ ] Login, signup, and Google sign-in still work and still redirect to `/` on success; validation and error messages are unchanged.
- [ ] `authGuard` redirects unauthenticated users to `/auth`; `logout()` returns to `/auth`.
- [ ] No duplicate `id="googleBtn"` in the DOM in any mode.
