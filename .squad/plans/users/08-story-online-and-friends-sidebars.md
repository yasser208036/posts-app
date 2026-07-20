# Story 08 — Two-column shell: online-users left sidebar + friends right sidebar

---

## Prerequisites

- [Story 07 completed](07-story-friendship-domain-api.md): `GET /api/users`, `GET /api/friends`, and `POST /api/friends/requests` exist and return `PublicUser`/`PublicUser[]`. This story is the **UI consumer** of those endpoints plus a small presence addition.
- [Story 06 completed](../create-data-base/06-story-postgres-prisma-persistence.md): Prisma is the data layer; `req.userId` scoping is established.
- **Presence is heartbeat polling, not WebSockets** (deferred by design — see intake "Extra notes"). A user is "online" if their `lastSeenAt` is within a freshness window; the frontend pings a heartbeat endpoint on an interval. No socket server is introduced.
- **Frontend is standalone components + Tailwind v4** (`CLAUDE.md` "Conventions"). The new sidebars live in the `AppComponent` shell around the `<router-outlet>`, so they persist across route changes.

---

## Story Goal

Add a persistent two-column layout: a **left sidebar** of currently-online users (each offering "add friend") and a **right sidebar** of the caller's accepted friends, both auto-refreshing via polling.

1. **Presence tracking** — `User` gains `lastSeenAt`; a `POST /api/presence/ping` endpoint stamps `lastSeenAt = now()` for the caller.
2. **Online users** — `GET /api/users` (from Story 07) is extended so each returned user carries an `online` boolean (`lastSeenAt` within the freshness window). The left sidebar lists online users (excluding the caller) with their name and an "Add friend" button.
3. **Send request from sidebar** — clicking "Add friend" calls `POST /api/friends/requests`; the button reflects pending/friend/self state so a user can't send twice (acceptance criterion 2).
4. **Friends sidebar** — the right sidebar lists accepted friends (`GET /api/friends`), updating on the same poll so it reflects newly-accepted friendships (acceptance criterion 5).

**Not in scope:** the notification dropdown / accept-reject UI (Story 09 — the left sidebar only *sends*), friends' posts and comments (Story 10), true real-time push, and per-user unread state.

---

## Product rules (from story)

| Behaviour | Current | New |
|---|---|---|
| Layout | Single centered column (`AppComponent` `max-w-5xl`, `app.component.ts` line 120) | **Left + right sidebars flanking the outlet** |
| Online status | None | **`lastSeenAt` within freshness window → `online: true`** |
| `GET /api/users` shape | `PublicUser[]` (Story 07) | **`(PublicUser & { online: boolean })[]`** |
| Add-friend affordance | None | **Per-user button; disabled when self/pending/already-friend** |

---

## Context — Read These Files First

1. `frontend/src/app/app.component.ts` — **lines 12–167**. The shell template. The centered `<main>`/`<div class="mx-auto max-w-5xl …">` (lines 119–123) is widened and split into three columns. The class already injects `AuthService` (line 143) and subscribes to `user$` (line 145) — reuse for "is this me". Add the sidebar polling here or in a dedicated child component (preferred: `SidebarsComponent`, see Frontend Task 3).
2. `frontend/src/app/services/post.service.ts` — **read whole (48 lines)**. The `Injectable`/`HttpClient`/`environment.apiUrl` service pattern (`${environment.apiUrl}/posts`, line 9) to mirror for `UserService`/`FriendService`.
3. `frontend/src/app/services/auth.service.ts` — **lines 10–29, 60–76**. `user$` (line 19) exposes the current `AuthUser`; use `userSubject.value?.id` to exclude self and detect friend state.
4. `frontend/src/app/models/user.model.ts` — **read whole (10 lines)**. `AuthUser` (1–5). Add `OnlineUser` and `Friend` types (Frontend Task 1).
5. `frontend/src/app/components/post-list/post-list.component.ts` — **lines 32–52**. The `Subject` + `interval`/`debounceTime` + `Subscription` cleanup pattern (`ngOnInit`/`ngOnDestroy`) to mirror for the presence poll.
6. `frontend/src/app/components/post-list/post-list.component.html` — **lines 1–63**. Tailwind card/label/button classes (`rounded-2xl border border-slate-200/80 bg-white`, indigo buttons) to match in the sidebars.
7. `backend/src/users.data.ts` — **lines 9–47**. `toUser` mapper and `createUser`; add `lastSeenAt` to the mapper and a `touchLastSeen` / `listOtherUsersWithPresence` helper.
8. `backend/src/friends.data.ts` (from Story 07) — **`listOtherUsers`, `existingActiveRequest`, `listFriends`**. Extend `listOtherUsers` to include `lastSeenAt` and compute `online`, or add `listOtherUsersWithPresence`.
9. `backend/prisma/schema.prisma` — **lines 10–18**. Add `lastSeenAt DateTime?` to `User`.
10. `backend/src/controllers/users.controller.ts` (from Story 07) — the `listUsers` handler that gains the `online` computation.

---

## Backend Tasks

### 1 — Schema: `lastSeenAt`

**File: `backend/prisma/schema.prisma`** — add to `User` (lines 10–18):

```prisma
lastSeenAt DateTime?  // null until first heartbeat; drives online status
```

Run `pnpm prisma:migrate` (name `add_last_seen_at`) + `pnpm prisma:generate`. **Nullable** so existing rows migrate cleanly.

### 2 — Presence data + endpoint

**File: `backend/src/users.data.ts`**:
- Add `lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null` to `toUser` (after line 16) and the field to the `User` interface in `types.ts` (line 30–37) as `lastSeenAt: string | null`.
- Add `export const touchLastSeen = async (id: string): Promise<void>` → `prisma.user.update({ where: { id }, data: { lastSeenAt: new Date() } })`.

**File: `backend/src/friends.data.ts`** — change `listOtherUsers` to select `lastSeenAt` and return `PublicUser & { online: boolean }`, computing `online = lastSeenAt != null && Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MS`. Define `const ONLINE_WINDOW_MS = 60_000;` (60s — twice the 30s client ping interval, so one missed ping doesn't flip a user offline).

**Create file: `backend/src/routes/presence.routes.ts`** + **`backend/src/controllers/presence.controller.ts`**:

```ts
// controller
export async function ping(req, res, next) {
  try { await touchLastSeen(req.userId!); res.status(204).send(); }
  catch (err) { next(err); }
}
// route
router.post("/ping", requireAuth, ping);
```

**File: `backend/src/app.ts`** — mount `app.use("/api/presence", presenceRouter);` before `notFoundHandler`.

### 3 — `GET /api/users` carries `online`

**File: `backend/src/controllers/users.controller.ts`** — `listUsers` returns the enriched array from `listOtherUsers`. Response shape becomes `(PublicUser & { online: boolean })[]`. **Update the Story 07 contract row in `CLAUDE.md`** accordingly.

---

## Frontend Tasks

### 1 — Models

**File: `frontend/src/app/models/user.model.ts`** — append:

```ts
export interface OnlineUser {
  id: string;
  name: string;
  email: string;
  online: boolean;
}

export type Friend = AuthUser; // { id, name, email }
```

### 2 — Services

**Create file: `frontend/src/app/services/user.service.ts`** — `listUsers(): Observable<OnlineUser[]>` → `GET ${apiUrl}/users`; `ping(): Observable<void>` → `POST ${apiUrl}/presence/ping`. Mirror `PostService` (Injectable/HttpClient).

**Create file: `frontend/src/app/services/friend.service.ts`** — `listFriends(): Observable<Friend[]>` → `GET ${apiUrl}/friends`; `sendRequest(receiverId: string): Observable<unknown>` → `POST ${apiUrl}/friends/requests` with `{ receiverId }`. (Requests/accept/reject methods are added in Story 09 — leave room but do not implement the dropdown here.)

The `authInterceptor` (`frontend/src/app/interceptors/auth.interceptor.ts`) already attaches the bearer token — no per-call header work.

### 3 — Sidebars component + shell layout

**Create file: `frontend/src/app/components/sidebars/sidebars.component.ts`** (standalone, `CommonModule`). Two exported inline-template blocks or two child components — keep it one `SidebarsComponent` with `@Input() side: "left" | "right"` **or** two small components (`OnlineUsersComponent`, `FriendsListComponent`); pick the two-component split for clarity.

- **Left (online users):** on `ngOnInit`, `ping()` immediately, then `interval(30_000)` → `ping()` + `userService.listUsers()`; filter out self (`auth` current id) and render each with name + a green "online" dot when `online`. "Add friend" button → `friendService.sendRequest(u.id)`; on success set local `sent` state so the button disables ("Requested"). Disable for users already in the friends list ("Friends"). Clean up in `ngOnDestroy` (`Subscription`, mirror `post-list.component.ts` lines 32–56).
- **Right (friends):** `interval(30_000)` → `friendService.listFriends()`; render name per friend; empty state "No friends yet".
- Both handle `loading` + `error` (`CLAUDE.md` "every API call handles loading + error").

**File: `frontend/src/app/app.component.ts`** — replace the single centered `<main>` block (lines 119–123) with a three-column responsive grid: left sidebar, `<router-outlet>` (center), right sidebar. Hide both sidebars on auth pages via the existing `*ngIf="!isAuthPage"` gate (line 63 pattern). Suggested Tailwind:

```html
<main class="flex-1 pb-16 pt-8">
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)_16rem] gap-6">
    <app-online-users *ngIf="!isAuthPage" class="hidden lg:block"></app-online-users>
    <div class="min-w-0"><router-outlet></router-outlet></div>
    <app-friends-list *ngIf="!isAuthPage" class="hidden lg:block"></app-friends-list>
  </div>
</main>
```

Add the two components to `AppComponent` `imports` (line 15).

---

## Edge Cases & Failure Modes

- **Never-pinged user** — `lastSeenAt` null → `online: false`. Enforced in the `listOtherUsers` computation (`lastSeenAt != null && …`).
- **Missed single ping** — `ONLINE_WINDOW_MS` (60s) is 2× the client interval (30s), so one dropped ping doesn't flip the user offline.
- **Self in the list** — backend `listOtherUsers` already excludes `req.userId`; the left sidebar also filters by current id as defense in depth.
- **Add-friend button spam** — after a successful send the button switches to a disabled "Requested" state (local flag); a 409 from the backend (duplicate) is caught and also disables the button with "Requested" (idempotent UX). A 400 self-request cannot occur because self is filtered out.
- **Already-friends** — a user present in the friends list shows "Friends" (disabled), not "Add friend".
- **Poll during logout** — sidebars are `*ngIf="!isAuthPage"` and the interceptor drops requests with no token; on logout the shell navigates to `/login`, unmounting the sidebars (`ngOnDestroy` unsubscribes). Verify no interval leaks after logout.
- **Backend down / 500** — sidebars show a small inline error and keep the last good list; the interval keeps retrying.
- **Clock skew** — `online` is computed **server-side** with server `now()`, so client clock differences don't affect it.

---

## Test Plan

1. **Backend unit** (`backend/src/friends.data.test.ts`, extend Story 07 suite): `listOtherUsers` marks a user with fresh `lastSeenAt` as `online: true`, a stale/`null` one as `false`; caller excluded.
2. **Backend integration** (`backend/src/presence.routes.test.ts`): `POST /api/presence/ping` returns 204 and a subsequent `GET /api/users` shows the pinger as online to another user.
3. **Frontend** — no test runner is configured in `frontend` (no `test` target in `CLAUDE.md`); verify by build + manual (see Verification). If a frontend runner is later added, cover: online filtering excludes self, "Add friend" disables after send, friends list renders.

---

## Migration / Rollback

- **Forward:** additive nullable column `lastSeenAt` — `ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);`. No backfill; nulls read as offline.
- **Rollback:** `ALTER TABLE "User" DROP COLUMN "lastSeenAt";` and revert the `toUser` mapper. The `online` field in `GET /api/users` disappears; Story 08 UI degrades but Story 07 endpoints keep working.

---

## Verification Steps

1. **DB + migrate:** `docker compose up -d`; `cd backend && pnpm prisma:migrate && pnpm prisma:generate`.
2. **Backend builds/tests:** `cd backend && pnpm build && pnpm test`.
3. **Frontend builds:** `cd frontend && pnpm build` — `ng build` clean.
4. **Manual (two browsers / two accounts):** log in as A and B; A's left sidebar shows B online within ~30s; A clicks "Add friend" → button shows "Requested"; after B accepts (Story 09, or via curl), A's right sidebar lists B on the next poll.
5. **Regression:** the centered post list still renders inside the new center column; auth pages show no sidebars.

---

## Done Criteria

- [ ] `User.lastSeenAt` migrated (nullable); `POST /api/presence/ping` stamps it (204).
- [ ] `GET /api/users` returns each user with an `online` boolean computed server-side within a 60s window.
- [ ] Left sidebar lists online users (excluding self) and pings every 30s; "Add friend" sends a request and disables to "Requested"/"Friends".
- [ ] Right sidebar lists accepted friends and refreshes on the poll.
- [ ] Sidebars hidden on `/login` and `/signup`; intervals cleaned up on destroy/logout.
- [ ] `pnpm build` (backend + frontend) and `pnpm test` (backend) pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 09.**
