# posts — plan overview

Entry point for the **posts** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                            | Title                                                              | Tracker id | Depends on | Status    |
| --- | ------------------------------- | ------------------------------------------------------------------ | ---------- | ---------- | --------- |
| 01  | `01-story-enhance-add-post.md`  | Enhance add post: show form in a popup instead of a separate page  | —          | None       | Completed |
| 02  | `02-story-enhance-edit-post.md` | Enhance edit post: show form in a popup instead of a separate page | —          | Story 01   | Completed |
| 03  | `03-story-pagination-and-dates.md` | Pagination and date display on post cards | —          | Story 02   | Planned   |
| 04  | `04-story-search-filter.md`     | Search posts by title and filter by date                           | —          | Story 03   | Planned   |
| 05  | `05-story-authentication.md`    | Authentication system (email/password + Google, JWT sessions)      | —          | Story 04   | Planned   |
| 12  | `12-story-unified-posts-feed.md` | Unified posts feed: own + friends' posts on the main page, remove `/feed` | —          | Story 10   | Planned   |
| 13  | `13-story-comment-edit-delete-replies.md` | Editable/deletable own comments, one-level replies, sticky sidebars | —          | Story 12   | Planned   |
| 15  | `15-story-enhance-pagination.md` | Enhance pagination: infinite scroll, newest first, remove post count badge | —          | Story 13   | Planned   |

## Dependency notes

- Story 02 depends on Story 01: it reuses `ModalComponent`, the `PostFormComponent` embedded mode, and the existing modal integration in `PostListComponent`.
- Story 03 depends on Story 02: it extends `PostListComponent` which already includes the create/edit modal integration from Stories 01–02.
- Story 04 depends on Story 03: it extends the paginated `getPaginatedPosts` data layer and `PostListComponent` fetch/pagination flow, applying filters before pagination so `total`/`totalPages` reflect the filtered set.
- Story 05 depends on Story 04: it adds an `/api/auth/*` router alongside the existing posts router, puts `POST/PUT/DELETE /api/posts` behind a `requireAuth` middleware, and adds `/login` + `/signup` routes plus an auth interceptor and route guard to the frontend built up through Stories 01–04. Introduces backend dependencies (password hashing, JWT, Google token verification) — an explicit, scoped exception to `CLAUDE.md`'s "no auth / no new dependencies" rule.
- Story 12 depends on [Story 10](../users/10-story-friends-posts-and-comments.md): it folds the friends' feed (`getFriendsFeed`, `/api/feed`, `FeedComponent`) into the main list — `GET /api/posts` widens to own + friends' posts (each with `author`), the main page reuses the feed card, and the `/feed` route/component/link are removed. Edit/delete and comment permissions stay owner/friend-scoped.
- Story 13 depends on Story 12: it extends the unified feed's inline comment thread (`PostListComponent`, `post-list.component.html`) and the `Comment` model with author-scoped edit/delete (`PUT`/`DELETE /api/posts/:id/comments/:commentId`) and one-level replies (`Comment.parentId` self-relation, flattened server-side). Also makes the two shell sidebars sticky (`app.component.ts`). No change to post owner-scoping.
- Story 15 depends on Story 13: it changes `PostListComponent` pagination from Previous/Next page buttons to infinite scroll (IntersectionObserver sentinel appending pages), removes the "posts available" count badge, and confirms newest-first ordering (already `orderBy: { createdAt: "desc" }` in `data.ts`). Frontend-only — no backend/API change.
