# Story 14 — Enhance notifications: comments & replies feed, navigate-to-comment, live friend accept, click-away close

## Prerequisites

- [Story 09 completed](../users/09-story-header-notifications.md): the header notification bell + dropdown (`frontend/src/app/components/notifications/notifications.component.ts`) and the friend-request accept/reject wiring in `FriendService`. **This story widens that dropdown** from friend-requests-only to a unified feed.
- [Story 10 completed](../users/10-story-friends-posts-and-comments.md) and [Story 13 completed](../posts/13-story-comment-edit-delete-replies.md): comments + one-level replies exist end to end — `Comment` model (`backend/prisma/schema.prisma` lines 38–52), comment data functions (`backend/src/data.ts` lines 159–229), and the post-list comment thread UI (`frontend/src/app/components/post-list/post-list.component.ts` lines 190–331 and `post-list.component.html` lines 212–250, 414–509).
- [Story 08 completed](../users/08-story-online-and-friends-sidebars.md): the right friends sidebar (`frontend/src/app/components/sidebars/friends-list.component.ts`) that must refresh the instant a request is accepted.
- **Polling stays the baseline** (no WebSockets). This story adds a **new backend aggregation endpoint** and **event-driven cross-component refresh on accept**; the 30s poll remains as the steady-state refresh.
- **No read/unread persistence.** There is no notifications table; the feed is derived on each request from existing rows (friend requests + comments). A per-notification "seen" state is **out of scope** (consistent with Story 09's stated scope).

---

## Story Goal

Turn the header bell from a friend-requests-only dropdown into a **unified notifications feed** and make it act on clicks:

1. **Feed shows three kinds** — pending incoming **friend requests**, **comments on my posts**, and **replies to my comments**, newest first (acceptance criterion 1).
2. **Click a comment/reply → jump to it** — selecting a comment or reply notification navigates to `/`, expands that post's thread, scrolls to the comment, and briefly highlights it (acceptance criterion 2).
3. **Accepting a request updates both lists immediately** — the friends sidebar gains the new friend and the posts feed refetches (the new friend's posts appear) without waiting for the next 30s poll (acceptance criterion 3).
4. **Click-away closes the dropdown from anywhere** — clicking anywhere on the page (not just the navbar) closes the open dropdown (acceptance criterion 4).

**Not in scope:** read/unread state, notification persistence/history, comment notifications for posts that are not the caller's own beyond replies-to-my-comments, desktop/toast push, and cross-page deep-scroll when the target post is not on feed page 1 (documented limitation in **Edge Cases**).

---

## Product rules (from story)

| Behaviour | Current | New |
|---|---|---|
| Dropdown contents | Pending friend requests only (`notifications.component.ts` lines 60–87, from `GET /api/friends/requests`) | **Friend requests + comments on my posts + replies to my comments**, merged newest-first |
| Clicking a comment/reply | No comment items exist | **Navigate to `/`, expand the post, scroll to & highlight the comment** |
| Accepting a request | Item removed from dropdown; sidebar/feed catch up on their own 30s poll | **Sidebar + posts feed refetch immediately** via a shared event |
| Closing the dropdown | `fixed inset-0` backdrop that (because the navbar `<header>` uses `backdrop-blur-md`) only covers the navbar strip — clicks on page body don't close it | **Document-level click-away closes from anywhere** |

---

## Context — Read These Files First

1. `frontend/src/app/components/notifications/notifications.component.ts` — **read the whole file (174 lines)**. The bell/badge markup (lines 16–42), the click-away backdrop to **replace** (lines 44–46), the poll in `ngOnInit` (lines 109–124), and `accept`/`reject`/`mutate` (lines 142–168). Badge count is `requests.length` (lines 37, 40) — becomes `notifications.length`.
2. `frontend/src/app/services/friend.service.ts` — **whole file (32 lines)**. `listIncomingRequests`/`acceptRequest`/`rejectRequest` stay; the feed fetch moves to a new `NotificationService`.
3. `frontend/src/app/components/post-list/post-list.component.ts` — **lines 36–76** (comment state maps, `ngOnInit` subscriptions incl. `createTrigger.trigger$`), **lines 190–209** (`toggleComments`, `reloadComments`), **lines 61–76** (subscription pattern to copy for a nav subscription). This is where navigate-to-comment lands.
4. `frontend/src/app/components/post-list/post-list.component.html` — **lines 110–113** (the `<article *ngFor>` that needs `id="post-{{post.id}}"`), **lines 212–250** (thread container + `topLevel`/`repliesFor` loops), **lines 414–509** (`#commentBlock` template — its outer element needs `id="comment-{{comment.id}}"` and a highlight class binding).
5. `frontend/src/app/services/create-post-trigger.service.ts` — **whole file**; the exact `Subject`-based decoupling pattern to copy for the two new services (`NotificationNavService`, `FriendEventsService`).
6. `frontend/src/app/app.component.ts` — **lines 96–98** (where `<app-notifications>` is mounted) and the `Router` usage (lines 166–190). Navigation to `/` before emitting a nav event mirrors `openNewPost` (lines 188–190).
7. `frontend/src/app/components/sidebars/friends-list.component.ts` — **lines 51–71** (`interval` poll + `listFriends`). Add an immediate refetch on the `FriendEventsService.accepted$` event.
8. `backend/src/data.ts` — **lines 11–41** (`publicUserSelect`, `toComment`, `Prisma.CommentGetPayload` pattern) and **lines 222–229** (`listComments` query shape). The new comment/reply queries copy this include/select style.
9. `backend/src/friends.data.ts` — **lines 96–118** (`listIncomingRequests` → `FriendRequestDto`). The notifications aggregator **reuses** this for the friend-request slice.
10. `backend/src/routes/friends.routes.ts` + `backend/src/app.ts` — the router-mount pattern (`app.use("/api/friends", …)`, line 19 of `app.ts`) to copy for `/api/notifications`.
11. `backend/src/types.ts` — **lines 62–89** (`FriendRequestDto`, `Comment`, `PublicUser`, `FeedPost`). Add the `NotificationDto` union here.
12. `backend/src/data.test.ts` (lines 1–40) and `backend/src/friends.data.test.ts` (lines 1–45) — the `prismaMock` + `jest.mock("./prisma")` unit-test pattern the new `notifications.data` tests must follow.

---

## Backend Tasks

### 1 — Add the `NotificationDto` union to `types.ts`

**File: `backend/src/types.ts`** — append after `FeedPost` (after line 89):

```ts
// A single item in the unified notifications feed (GET /api/notifications).
// `id` is the underlying entity id (friend-request id, or comment id) and is
// unique across kinds. `actor` is who caused it (sender / commenter).
export type NotificationDto =
  | {
      kind: "friend_request";
      id: string; // = friend request id (used for accept/reject)
      createdAt: string;
      actor: PublicUser;
    }
  | {
      kind: "comment" | "reply";
      id: string; // = comment id
      createdAt: string;
      actor: PublicUser;
      postId: string;
      commentId: string;
      parentId: string | null;
      postTitle: string;
      snippet: string; // first 80 chars of the comment body
    };
```

### 2 — Aggregate the feed in a new data module

**Create file: `backend/src/notifications.data.ts`**

- Import `prisma` from `./prisma`, `NotificationDto`/`PublicUser` from `./types`, and `listIncomingRequests` from `./friends.data`.
- Copy the `publicUserSelect = { id: true, name: true, email: true } as const` const from `data.ts` (line 12).
- Cap each comment/reply query with `take: 20` (see **Edge Cases** — no read-state, so the feed is bounded by recency).

```ts
const SNIPPET_LEN = 80;
const PER_SOURCE_LIMIT = 20;

// Comments on MY posts, authored by someone else. Covers top-level comments AND
// replies that live on my posts; the kind is derived from parentId.
async function commentsOnMyPosts(userId: string) {
  return prisma.comment.findMany({
    where: { authorId: { not: userId }, post: { userId } },
    include: {
      author: { select: publicUserSelect },
      post: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
}

// Replies to MY comments on posts I DON'T own (posts I own are already covered
// by commentsOnMyPosts, so the two sources are disjoint by post ownership — no
// dedup needed). parent.authorId === userId means the reply targets my comment.
async function repliesToMyComments(userId: string) {
  return prisma.comment.findMany({
    where: {
      authorId: { not: userId },
      parent: { authorId: userId },
      post: { userId: { not: userId } },
    },
    include: {
      author: { select: publicUserSelect },
      post: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
}

export async function listNotifications(
  userId: string,
): Promise<NotificationDto[]> {
  const [requests, comments, replies] = await Promise.all([
    listIncomingRequests(userId), // FriendRequestDto[]
    commentsOnMyPosts(userId),
    repliesToMyComments(userId),
  ]);

  const requestItems: NotificationDto[] = requests.map((r) => ({
    kind: "friend_request",
    id: r.id,
    createdAt: r.createdAt,
    actor: r.sender,
  }));

  const toCommentItem = (row: (typeof comments)[number]): NotificationDto => ({
    kind: row.parentId ? "reply" : "comment",
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    actor: row.author,
    postId: row.postId,
    commentId: row.id,
    parentId: row.parentId,
    postTitle: row.post.title,
    snippet: row.body.slice(0, SNIPPET_LEN),
  });

  // repliesToMyComments are always kind "reply" regardless of the post owner;
  // force it so a reply on a friend's post isn't mislabelled.
  const replyItems: NotificationDto[] = replies.map((row) => ({
    ...toCommentItem(row),
    kind: "reply",
  }));

  return [...requestItems, ...comments.map(toCommentItem), ...replyItems].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}
```

### 3 — Controller + route

**Create file: `backend/src/controllers/notifications.controller.ts`** — thin, mirrors `friends.controller.ts` `listRequests` (lines 49–60):

```ts
import { Request, Response, NextFunction } from "express";
import * as notificationsData from "../notifications.data";

export async function listNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const notifications = await notificationsData.listNotifications(
      req.userId!,
    );
    res.status(200).json(notifications);
  } catch (err) {
    next(err);
  }
}
```

**Create file: `backend/src/routes/notifications.routes.ts`** (copy `friends.routes.ts` structure):

```ts
import { Router } from "express";
import { listNotifications } from "../controllers/notifications.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();
router.get("/", requireAuth, listNotifications);
export default router;
```

**File: `backend/src/app.ts`** — add the import next to the others (after line 6) and mount after `/api/presence` (after line 19):

```ts
import notificationsRouter from "./routes/notifications.routes";
// …
app.use("/api/notifications", notificationsRouter);
```

---

## Frontend Tasks

### 1 — `Notification` model

**File: `frontend/src/app/models/user.model.ts`** — append (keep `FriendRequest`, lines 25–29, unchanged; accept/reject still use it):

```ts
// One item in the unified notifications feed (GET /api/notifications).
export type Notification =
  | {
      kind: "friend_request";
      id: string; // friend request id — accept/reject act on this
      createdAt: string;
      actor: AuthUser;
    }
  | {
      kind: "comment" | "reply";
      id: string; // comment id
      createdAt: string;
      actor: AuthUser;
      postId: string;
      commentId: string;
      parentId: string | null;
      postTitle: string;
      snippet: string;
    };
```

### 2 — `NotificationService`

**Create file: `frontend/src/app/services/notification.service.ts`** (mirror `friend.service.ts` lines 1–15):

```ts
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";
import { Notification } from "../models/user.model";

@Injectable({ providedIn: "root" })
export class NotificationService {
  private baseUrl = `${environment.apiUrl}/notifications`;
  constructor(private http: HttpClient) {}
  list(): Observable<Notification[]> {
    return this.http.get<Notification[]>(this.baseUrl);
  }
}
```

### 3 — Two decoupling services (copy `create-post-trigger.service.ts`)

**Create file: `frontend/src/app/services/notification-nav.service.ts`** — shared Subject the dropdown uses to tell the post list to open a specific comment:

```ts
import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

export interface CommentTarget {
  postId: string;
  commentId: string;
}

@Injectable({ providedIn: "root" })
export class NotificationNavService {
  private target$ = new Subject<CommentTarget>();
  readonly navigate$ = this.target$.asObservable();
  navigateToComment(target: CommentTarget): void {
    this.target$.next(target);
  }
}
```

**Create file: `frontend/src/app/services/friend-events.service.ts`** — fires when a request is accepted so the sidebar and feed refetch now, not on their next poll:

```ts
import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

@Injectable({ providedIn: "root" })
export class FriendEventsService {
  private accepted = new Subject<void>();
  readonly accepted$ = this.accepted.asObservable();
  notifyAccepted(): void {
    this.accepted.next();
  }
}
```

### 4 — Rework `NotificationsComponent`

**File: `frontend/src/app/components/notifications/notifications.component.ts`**

- **Imports/fields:** replace `FriendRequest` usage with `Notification`; keep `FriendService` (accept/reject) and add `NotificationService`, `NotificationNavService`, `FriendEventsService`, and Angular `Router`. Rename `requests: FriendRequest[]` → `notifications: Notification[] = []`.
- **Badge count:** change the `*ngIf`/interpolation (lines 37, 40) from `requests.length` to `notifications.length`.
- **Poll (lines 109–124):** switch `friendService.listIncomingRequests()` → `notificationService.list()`, assigning to `this.notifications` (keep the `catchError(() => of(null))` + "keep last list" pattern).
- **Click-away (replace lines 44–46):** delete the `<div class="fixed inset-0 z-40" (click)="close()">` backdrop. Add a document click-away instead — the `fixed inset-0` overlay fails because the navbar `<header>` uses `backdrop-blur-md` (`backdrop-filter`), which makes `position: fixed` descendants contain to the header box, so the overlay only covers the navbar strip. Use a host listener keyed off the component's own element:

```ts
import { Component, ElementRef, HostListener, OnDestroy, OnInit } from "@angular/core";
// …
constructor(
  private friendService: FriendService,
  private notificationService: NotificationService,
  private nav: NotificationNavService,
  private friendEvents: FriendEventsService,
  private router: Router,
  private host: ElementRef<HTMLElement>,
) {}

@HostListener("document:click", ["$event"])
onDocumentClick(event: MouseEvent): void {
  if (this.open && !this.host.nativeElement.contains(event.target as Node)) {
    this.close();
  }
}
```

  Keep the bell `(click)="toggle()"`; because the bell is inside the host element, its click won't be treated as "outside", so `toggle()` still works. (No `stopPropagation` needed — the `contains` check covers it.)
- **Template — render three kinds.** Replace the `*ngFor="let request of requests"` list (lines 60–87) with `*ngFor="let n of notifications; trackBy: trackById"`. Branch on `n.kind`:
  - **`friend_request`**: `n.actor.name` + "sent you a friend request", with the existing **Accept / Reject** buttons calling `accept(n)` / `reject(n)`.
  - **`comment` / `reply`**: a clickable row — `(click)="openComment(n)"` — showing `n.actor.name`, the verb (`n.kind === 'reply' ? 'replied' : 'commented'`), `n.postTitle`, and `n.snippet`. Add `cursor-pointer hover:bg-slate-50` to match existing row styling (lines 61–63).
  - Empty state stays: "No new notifications." keyed on `!notifications.length`.
- **`trackById(_i, n)`** returns `n.id`.
- **`accept(n)` / `reject(n)`:** operate only on `friend_request` items — pass `n.id` (the request id) to `friendService.acceptRequest`/`rejectRequest`. On **accept success**, in addition to removing the item, call `this.friendEvents.notifyAccepted()`. Keep the existing `pendingIds`/`mutate`/`remove` machinery (lines 102–173), but key `remove` and `pendingIds` on `n.id`.
- **`openComment(n)`** (comment/reply only):

```ts
openComment(n: Notification): void {
  if (n.kind === "friend_request") return;
  this.close();
  this.router
    .navigate(["/"])
    .then(() =>
      this.nav.navigateToComment({ postId: n.postId, commentId: n.commentId }),
    );
}
```

### 5 — Navigate-to-comment in `PostListComponent`

**File: `frontend/src/app/components/post-list/post-list.component.ts`**

- Inject `NotificationNavService` and `FriendEventsService` in the constructor (lines 55–59).
- Add fields: `highlightedCommentId: string | null = null;` and `private pendingScroll: { postId: string; commentId: string } | null = null;`.
- In `ngOnInit` (after line 74) add two subscriptions (use the existing `this.sub.add(...)` pattern):

```ts
this.sub.add(
  this.nav.navigate$.subscribe((t) => this.openCommentTarget(t.postId, t.commentId)),
);
this.sub.add(
  this.friendEvents.accepted$.subscribe(() => {
    this.currentPage = 1;
    this.fetchPosts(); // new friend's posts now visible in the feed
  }),
);
```

- Add `openCommentTarget`. It clears filters (a filtered/other page may hide the post), resets to page 1, refetches, then expands + loads comments + scrolls. Because comments load async, stash the target and finish the scroll in `reloadComments`:

```ts
openCommentTarget(postId: string, commentId: string): void {
  this.searchTerm = "";
  this.startDate = "";
  this.endDate = "";
  this.currentPage = 1;
  this.pendingScroll = { postId, commentId };
  this.postService
    .getAll(this.currentPage, this.pageSize, {})
    .subscribe({
      next: (response) => {
        this.posts = response.data;
        this.totalPosts = response.total;
        this.totalPages = response.totalPages;
        this.currentPage = response.page;
        this.loading = false;
        const found = this.posts.some((p) => p.id === postId);
        if (!found) {
          this.pendingScroll = null; // post not on page 1 — documented limitation
          return;
        }
        this.expanded.add(postId);
        this.reloadComments(postId); // completes the scroll via pendingScroll
      },
      error: () => {
        this.pendingScroll = null;
        this.errorMessage = "Failed to load posts. Please try again.";
        this.loading = false;
      },
    });
}
```

- Extend `reloadComments` (lines 199–209): after `this.comments[postId] = comments;` and marking loaded, if `pendingScroll?.postId === postId`, run the scroll/highlight on the next macrotask so the `*ngIf="expanded.has(post.id)"` thread has rendered:

```ts
if (this.pendingScroll?.postId === postId) {
  const { commentId } = this.pendingScroll;
  this.pendingScroll = null;
  setTimeout(() => this.scrollToComment(commentId), 0);
}
```

```ts
private scrollToComment(commentId: string): void {
  const el = document.getElementById(`comment-${commentId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  this.highlightedCommentId = commentId;
  setTimeout(() => {
    if (this.highlightedCommentId === commentId) this.highlightedCommentId = null;
  }, 2000);
}
```

**File: `frontend/src/app/components/post-list/post-list.component.html`**

- **Post anchor:** on the `<article *ngFor>` (line 110) add `[id]="'post-' + post.id"`.
- **Comment anchor + highlight:** on the outer element of `#commentBlock` (the wrapper starting at line 416, inside the template at 415) add `[id]="'comment-' + comment.id"` and `[class.ring-2]="highlightedCommentId === comment.id"` `[class.ring-indigo-400]="highlightedCommentId === comment.id"` `[class.rounded-xl]="highlightedCommentId === comment.id"` (a transient highlight ring; match the app's indigo accent).

### 6 — Live-refresh the friends sidebar on accept

**File: `frontend/src/app/components/sidebars/friends-list.component.ts`**

- Inject `FriendEventsService`.
- In `ngOnInit` (after line 71) add:

```ts
this.sub.add(
  this.friendEvents.accepted$.subscribe(() =>
    this.friendService.listFriends().subscribe((friends) => (this.friends = friends)),
  ),
);
```

  **Note:** `this.sub` is currently assigned a single `interval` subscription (line 53). Change it to a `new Subscription()` and `this.sub.add(...)` the interval stream (copy `post-list.component.ts` lines 62–75) so both the poll and the event subscription are tracked and cleaned up in `ngOnDestroy`.

### 7 — No change to `app.component.ts` mount

`<app-notifications>` (lines 96–98) stays as-is — the component gains behaviour internally. State **`No template change required in app.component.ts.`**

---

## Edge Cases & Failure Modes

- **Poll failure** — `notificationService.list()` errors: `catchError(() => of(null))` in `ngOnInit` keeps the last feed; the next 30s tick retries. Enforced in `notifications.component.ts` poll (existing pattern, lines 113–119).
- **Accept/reject of a stale request** — request already handled elsewhere returns 404/409; existing `mutate` (lines 159–166) removes the item and lets the next poll reconcile. On 404/409 the accept path still fires `notifyAccepted()` only on **success** (2xx), so a failed accept does not wrongly refetch.
- **Comment notification for a post not on feed page 1** — `openCommentTarget` clears filters and loads page 1; if the post isn't there (older than one page) it sets `pendingScroll = null` and does nothing further. **Documented limitation** — deep cross-page scroll is out of scope. The dropdown item still navigated to `/`.
- **Target comment collapsed/not yet loaded** — `openCommentTarget` forces `expanded.add(postId)` and calls `reloadComments`; the scroll runs from inside `reloadComments` (after data + one macrotask) so `#comment-<id>` exists in the DOM. If the comment was deleted between poll and click, `getElementById` returns null and `scrollToComment` no-ops.
- **`friend_request` id vs comment id collision** — both are UUIDs from different tables; `NotificationDto.id` uses the entity id and `trackById` keys on it. Collision probability is negligible; accept/reject only ever run on `kind === "friend_request"` items.
- **Disjoint comment sources** — `commentsOnMyPosts` (posts I own) and `repliesToMyComments` (`post.userId: { not: userId }`) never overlap, so no dedup is needed. A reply on my own post surfaces once, labelled `reply` (via `row.parentId`). Enforced by the `where` clauses in `notifications.data.ts`.
- **Self-actions excluded** — every comment/reply query filters `authorId: { not: userId }`; I never get notified about my own comments/replies.
- **Unbounded feed** — no read-state, so `take: 20` per comment/reply source bounds the payload; friend requests are already pending-only. The badge shows the current (bounded) count. Noted as a scope limitation, not a bug.
- **Dropdown open during logout** — `<app-notifications *ngIf="!isAuthPage && userName">` (app.component.ts lines 96–98) unmounts the component; `ngOnDestroy` (lines 126–128) clears the interval; the `@HostListener` is torn down with the component.
- **Click-away vs bell toggle** — the bell lives inside the host element, so `host.nativeElement.contains(event.target)` is true for bell clicks and the document handler does not double-close. Verified by the `contains` guard.

---

## Test Plan

1. **Backend unit — `backend/src/notifications.data.test.ts`** (new; copy the `prismaMock` + `jest.mock("./prisma")` pattern from `friends.data.test.ts` lines 1–21, adding `comment.findMany` to the mock). Assert `listNotifications`:
   - merges friend requests + comments-on-my-posts + replies-to-my-comments, sorted by `createdAt` desc;
   - labels a comment row with `parentId` as `kind: "reply"` and a `parentId: null` row as `kind: "comment"`;
   - excludes rows where `authorId === userId` (mock returns none for the `{ not: userId }` filter — assert the `where` passed to `comment.findMany` contains `authorId: { not: userId }`);
   - maps `snippet` to the first 80 chars of `body` and carries `postId`/`postTitle`.
2. **Backend integration (optional, if a routes suite exists)** — `GET /api/notifications` returns 401 without a token and a merged array with a valid token.
3. **Frontend** — no runner configured (CLAUDE.md). Verify via build + manual (below). If a runner is added later: badge = `notifications.length`; clicking a comment item emits `NotificationNavService.navigate$`; accept fires `FriendEventsService.accepted$`.

---

## Verification Steps

1. **Backend builds:** `cd backend && pnpm build` — no TS errors (the `NotificationDto` union and new module compile).
2. **Backend unit tests:** `cd backend && pnpm test` — new `notifications.data.test.ts` green, existing suites still pass.
3. **Frontend builds:** `cd frontend && pnpm build` — no errors.
4. **Manual (two accounts A & B, both friends):**
   - B comments on A's post and replies to A's comment → within ~30s A's bell count rises; open dropdown → both items show with actor name, post title, and snippet.
   - A clicks the comment item → lands on `/`, the post's thread expands, the page scrolls to the comment, and it flashes an indigo ring.
   - B sends A a friend request → A's dropdown shows it; A clicks **Accept** → item disappears, **B appears in A's right sidebar immediately**, and A's posts feed refetches (B's posts now visible) without waiting 30s.
   - With the dropdown open, click anywhere on the page body (a post card, the footer) → the dropdown closes.
5. **Regression:** friend-request Accept/Reject still work; New Post, login/logout, both sidebars, and the comment thread create/edit/delete/reply flows are unchanged; auth pages (`/auth`) show no bell.

---

## Done Criteria

- [ ] Dropdown shows friend requests **and** comments on my posts **and** replies to my comments, newest first.
- [ ] Clicking a comment/reply notification navigates to `/`, expands the post, scrolls to the comment, and highlights it (page-1 posts).
- [ ] Accepting a request updates the friends sidebar **and** the posts feed immediately (no 30s wait).
- [ ] Clicking anywhere on the page closes an open dropdown.
- [ ] `GET /api/notifications` is auth-gated and returns the merged `NotificationDto[]`.
- [ ] `pnpm build` (both sides) and `pnpm test` (backend, incl. new `notifications.data.test.ts`) pass.
- [ ] Overview `notifications/00-overview.md` and `00-index.md` updated with this story.
