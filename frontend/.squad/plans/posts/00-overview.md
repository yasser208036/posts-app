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

## Dependency notes

- Story 02 depends on Story 01: it reuses `ModalComponent`, the `PostFormComponent` embedded mode, and the existing modal integration in `PostListComponent`.
- Story 03 depends on Story 02: it extends `PostListComponent` which already includes the create/edit modal integration from Stories 01–02.
- Story 04 depends on Story 03: it extends the paginated `getPaginatedPosts` data layer and `PostListComponent` fetch/pagination flow, applying filters before pagination so `total`/`totalPages` reflect the filtered set.
- Story 05 depends on Story 04: it adds an `/api/auth/*` router alongside the existing posts router, puts `POST/PUT/DELETE /api/posts` behind a `requireAuth` middleware, and adds `/login` + `/signup` routes plus an auth interceptor and route guard to the frontend built up through Stories 01–04. Introduces backend dependencies (password hashing, JWT, Google token verification) — an explicit, scoped exception to `CLAUDE.md`'s "no auth / no new dependencies" rule.
