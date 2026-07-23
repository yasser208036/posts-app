# notifications — plan overview

Entry point for the **notifications** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                   | Title                                                                                                     | Tracker id | Depends on             | Status    |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- | ---------------------- | --------- |
| 14  | [14-story-enhance-notifications.md](14-story-enhance-notifications.md) | Enhance notifications: comments & replies feed, navigate-to-comment, live friend accept, click-away close | —          | Stories 08, 09, 10, 13 | Completed |

## Dependency notes

- **Story 14** widens the header notification bell (Story 09) from friend-requests-only to a unified feed that also surfaces comments and replies (Stories 10, 13). It adds a new backend `GET /api/notifications` aggregation endpoint and two frontend decoupling services (`NotificationNavService`, `FriendEventsService`) — the latter drives the immediate friends-sidebar (Story 08) and posts-feed refresh on accept.
- **Story 14 implementation note**: no template change is required in `app.component.ts`; `<app-notifications>` keeps its existing mount point and gains behaviour internally.
