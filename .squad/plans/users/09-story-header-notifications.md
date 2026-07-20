# Story 09 — Header notifications for incoming friend requests (accept / reject)

---

## Prerequisites

- [Story 07 completed](07-story-friendship-domain-api.md): the friend-request API — `GET /api/friends/requests` (incoming, pending), `POST /api/friends/requests/:id/accept`, `POST /api/friends/requests/:id/reject`. This story is the **header UI** for those endpoints.
- [Story 08 completed](08-story-online-and-friends-sidebars.md): the right friends sidebar and `FriendService`; accepting a request here must make the friend appear there on its next poll.
- **Polling, not push** (WebSockets/toasts deferred — intake "Extra notes"). A badge count refreshes on an interval; opening the dropdown fetches the list.

---

## Story Goal

Add a notification bell to the navbar showing the number of pending **incoming** friend requests, with a dropdown listing each request (sender name + Accept/Reject) that acts on it inline.

1. **Badge count** — the bell shows the count of pending incoming requests, polled every 30s (acceptance criterion 3).
2. **Dropdown** — clicking the bell opens a dropdown listing each incoming request with the **sender's name** and **Accept / Reject** buttons.
3. **Accept** — creates the friendship (backend, Story 07), removes the request from the dropdown, and decrements the badge; the accepted user appears in the right sidebar (Story 08) on its next poll.
4. **Reject** — marks the request rejected and removes it from the dropdown.

**Not in scope:** toast/desktop notifications, read/unread persistence beyond pending-vs-handled, outgoing-request management UI, and WebSocket push.

---

## Product rules (from story)

| Behaviour | Current | New |
|---|---|---|
| Header actions | New Post + login/logout (`app.component.ts` lines 61–113) | **+ notification bell with pending count** |
| Incoming requests | API only (Story 07) | **Surfaced in a header dropdown** |
| Accept | API only | **Inline button → friendship + list/badge update** |
| Reject | API only | **Inline button → request removed** |

---

## Context — Read These Files First

1. `frontend/src/app/app.component.ts` — **lines 61–116** (navbar actions block) and **lines 136–167** (class). Insert the bell between "New Post" (lines 62–82) and the auth block (lines 85–113). Gate with the existing `*ngIf="!isAuthPage"` + `userName` (logged-in) pattern.
2. `frontend/src/app/services/friend.service.ts` (from Story 08) — extend with request-list/accept/reject methods.
3. `frontend/src/app/components/post-list/post-list.component.ts` — **lines 32–56**. `interval`/`Subscription` polling + `ngOnDestroy` cleanup pattern for the badge poll.
4. `frontend/src/app/components/modal/modal.component.ts` — the existing overlay/close pattern; the dropdown is lighter (a click-away popover), but reuse Tailwind styling conventions.
5. `frontend/src/app/app.component.ts` — **lines 84–113**. The `ng-container`/`ng-template` conditional-render idiom to copy for open/closed dropdown state.
6. `backend/src/controllers/friends.controller.ts` (from Story 07) — confirm the accept/reject handlers return the shapes this UI expects (accept → `204` or the new friend; reject → `204`).
7. `backend/src/friends.data.ts` (from Story 07) — `listIncomingRequests` returns `{ id, sender: PublicUser, createdAt }[]`; the dropdown renders `sender.name`.

---

## Backend Tasks

`No new backend endpoints required.` Story 07 already provides `GET /api/friends/requests`, `POST /api/friends/requests/:id/accept`, `POST /api/friends/requests/:id/reject`.

**Verify only:** `GET /api/friends/requests` returns pending **incoming** requests as `{ id, sender: { id, name, email }, createdAt }[]` (sender name is required by acceptance criterion 3). If Story 07 returned only ids, add the `sender` join there — note the gap in `## Edge Cases` and coordinate, do not silently reshape.

---

## Frontend Tasks

### 1 — Extend `FriendService`

**File: `frontend/src/app/services/friend.service.ts`** — add:

```ts
listIncomingRequests(): Observable<FriendRequest[]> {
  return this.http.get<FriendRequest[]>(`${this.baseUrl}/requests`);
}
acceptRequest(id: string): Observable<void> {
  return this.http.post<void>(`${this.baseUrl}/requests/${id}/accept`, {});
}
rejectRequest(id: string): Observable<void> {
  return this.http.post<void>(`${this.baseUrl}/requests/${id}/reject`, {});
}
```

where `baseUrl = ${environment.apiUrl}/friends`.

**File: `frontend/src/app/models/user.model.ts`** — add:

```ts
export interface FriendRequest {
  id: string;
  sender: AuthUser; // { id, name, email }
  createdAt: string;
}
```

### 2 — Notifications component

**Create file: `frontend/src/app/components/notifications/notifications.component.ts`** (standalone, `CommonModule`):

- `ngOnInit`: fetch requests immediately, then `interval(30_000)` → `friendService.listIncomingRequests()`; store `requests: FriendRequest[]`; `count = requests.length`. Unsubscribe in `ngOnDestroy` (mirror `post-list.component.ts` 32–56).
- `open = false`; bell button toggles it; clicking a document backdrop closes it (use a `(click)` overlay div, as `modal.component.ts` does).
- **Bell + badge** markup (Tailwind, matches navbar buttons at `app.component.ts` 62–82):

```html
<button (click)="toggle()" class="relative inline-flex items-center rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50">
  <!-- bell svg -->
  <span *ngIf="count > 0"
        class="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-2xs font-bold text-white">
    {{ count }}
  </span>
</button>
```

- **Dropdown:** `*ngIf="open"` panel listing each request — `sender.name`, an Accept and a Reject button. Empty state: "No new requests".
- `accept(r)`: call `acceptRequest(r.id)`; on success remove `r` from `requests` (badge drops). `reject(r)`: `rejectRequest(r.id)`; remove on success. Both handle `error` (leave the item, show inline message).

### 3 — Mount in the navbar

**File: `frontend/src/app/app.component.ts`** — add `NotificationsComponent` to `imports` (line 15); place `<app-notifications *ngIf="!isAuthPage && userName"></app-notifications>` in the actions row (between lines 82 and 85).

---

## Edge Cases & Failure Modes

- **No pending requests** — badge hidden (`*ngIf="count > 0"`), dropdown shows "No new requests".
- **Accept a request already accepted/rejected elsewhere** — backend returns 404/409 (Story 07 ownership + state check); the component catches it, removes the stale item, and refetches on the next poll. Enforced by the accept/reject handlers scoping to `req.userId` as receiver.
- **Reject then it reappears** — the poll must not resurrect handled requests; `GET /api/friends/requests` returns **pending only** (Story 07 `where status = 'pending'`). Verify.
- **Accept updates the right sidebar** — the friends sidebar (Story 08) polls independently every 30s, so the new friend appears within one interval; there is no direct cross-component call (decoupled, like `CreatePostTriggerService`). Acceptable per "updates immediately" → within one poll cycle.
- **Concurrent accept from two tabs** — second accept hits an already-accepted row → 409/404, caught and ignored.
- **Sender name missing** — if `sender` is absent from the API (Story 07 gap), the dropdown would render blank; **this is why the backend "Verify only" step is mandatory**.
- **Dropdown open during logout** — `*ngIf="!isAuthPage && userName"` unmounts the component; `ngOnDestroy` clears the interval.
- **Badge count vs list drift** — `count` is derived from `requests.length`, so they never disagree.

---

## Test Plan

1. **Backend integration** (`backend/src/friends.routes.test.ts`, extend Story 07 suite): `GET /api/friends/requests` returns only pending incoming with `sender.name`; after `POST …/accept`, the request no longer appears and both users are friends; `POST …/reject` removes it without creating a friendship.
2. **Frontend** — no runner configured; verify via build + manual. If added later: badge reflects count, accept removes item + decrements, reject removes item.

---

## Verification Steps

1. **Backend builds/tests:** `cd backend && pnpm build && pnpm test`.
2. **Frontend builds:** `cd frontend && pnpm build`.
3. **Manual (two accounts):** B sends A a request (Story 08 sidebar); A's bell shows "1" within ~30s; A opens the dropdown, sees B's name; Accept → item disappears, badge → 0, B appears in A's right sidebar within a poll; repeat with Reject → item disappears, no friendship.
4. **Regression:** New Post button, login/logout, and both sidebars still work; auth pages show no bell.

---

## Done Criteria

- [ ] Navbar bell shows pending incoming request count, polled every 30s (hidden when 0 and on auth pages).
- [ ] Dropdown lists each incoming request with sender name + Accept/Reject.
- [ ] Accept creates the friendship, removes the item, decrements the badge; friend shows in the right sidebar within one poll.
- [ ] Reject removes the item and creates no friendship.
- [ ] `GET /api/friends/requests` confirmed to return pending-only with `sender`.
- [ ] `pnpm build` (both) and `pnpm test` (backend) pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 10.**
