# log-in-page — plan overview

Entry point for the **log-in-page** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 11 | [11-story-unified-auth-page.md](11-story-unified-auth-page.md) | Unified Authentication Page (Login & Sign Up) | — | [posts/05](../posts/05-story-authentication.md) |

## Dependency notes

- Story 11 is a **frontend-only layout/UX refactor** on top of the auth system from `../posts/05-story-authentication.md`. It reuses `LoginComponent`/`SignupComponent` and `AuthService` unchanged; it touches `app.component.ts`, `app.routes.ts`, and `guards/auth.guard.ts`, which were also extended by `../users/08`–`10`. No backend changes.
