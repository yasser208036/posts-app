# create-data-base — plan overview

Entry point for the **create-data-base** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on | Status |
|----|------|-------|------------|------------|--------|
| 06 | `06-story-postgres-prisma-persistence.md` | User & Posts persistence on PostgreSQL via Prisma (one-to-many, owner-scoped) | — | [posts/Story 05](../posts/05-story-authentication.md) | Planned |

## Dependency notes

- Story 06 depends on the **posts** feature's Story 05 (authentication): it reuses `requireAuth`, `req.userId`, and the JWT flow to scope every post to its owner. It introduces PostgreSQL + Prisma (an explicit, scoped exception to `CLAUDE.md`'s "no database unless asked" rule), replaces both in-memory stores, and makes the previously-public `GET /api/posts` routes auth-only and owner-scoped — a breaking change to the API contract documented in `CLAUDE.md`.
