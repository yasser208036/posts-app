# users — plan overview

Entry point for the **users** feature — connecting users: presence, friend requests, friendships, and interacting with friends' posts. Stories execute in order by their `NN` prefix.

Real-time is delivered by **polling** in this cut; WebSocket push, toast alerts, and online/offline as a live socket signal are deferred (see intake "Extra notes").

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 07 | [07-story-friendship-domain-api.md](07-story-friendship-domain-api.md) | Friendship domain: schema + friend/request API | — | Story 06 (persistence), Story 05 (auth) |
| 08 | [08-story-online-and-friends-sidebars.md](08-story-online-and-friends-sidebars.md) | Left "online users" + right "friends" sidebars (presence via heartbeat) | — | Story 07 |
| 09 | [09-story-header-notifications.md](09-story-header-notifications.md) | Header notifications for incoming requests (accept/reject) | — | Story 07, Story 08 |
| 10 | [10-story-friends-posts-and-comments.md](10-story-friends-posts-and-comments.md) | Friends' posts feed + comments | — | Story 07, Story 09 |

## Dependency notes

- **Story 07 is the foundation** — it adds the `FriendRequest`/`Friendship` schema and the entire friend/request REST API. Stories 08–10 are UI/read layers over it; none add friend-relationship endpoints of their own (10 adds only the separate feed + comment endpoints).
- **Presence** (Story 08) is a `lastSeenAt` heartbeat + threshold, polled — not a socket. "Online" means "seen within the last N minutes".
- **Notifications** (Story 09) poll the Story 07 request endpoints; accepting there surfaces the new friend in the Story 08 right sidebar on its next poll (decoupled, no direct call).
- **Feed + comments** (Story 10) leave the existing owner-scoped `/api/posts` unchanged; the friends' feed and comments are separate read/write endpoints.
- **Cross-feature:** all four build on [create-data-base/06](../create-data-base/06-story-postgres-prisma-persistence.md) (Prisma persistence) and [posts/05](../posts/05-story-authentication.md) (auth, `req.userId`).
