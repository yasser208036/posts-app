# posts — plan overview

Entry point for the **posts** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                            | Title                                                              | Tracker id | Depends on | Status    |
| --- | ------------------------------- | ------------------------------------------------------------------ | ---------- | ---------- | --------- |
| 01  | `01-story-enhance-add-post.md`  | Enhance add post: show form in a popup instead of a separate page  | —          | None       | Completed |
| 02  | `02-story-enhance-edit-post.md` | Enhance edit post: show form in a popup instead of a separate page | —          | Story 01   | Completed |
| 03  | `03-story-pagination-and-dates.md` | Pagination and date display on post cards | —          | Story 02   | Planned   |

## Dependency notes

- Story 02 depends on Story 01: it reuses `ModalComponent`, the `PostFormComponent` embedded mode, and the existing modal integration in `PostListComponent`.
- Story 03 depends on Story 02: it extends `PostListComponent` which already includes the create/edit modal integration from Stories 01–02.
