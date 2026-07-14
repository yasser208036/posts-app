# Posts App — Working Guide

## Stack

| Layer    | Tech                                                        | Port  |
|----------|-------------------------------------------------------------|-------|
| Backend  | Node.js + Express 4 + TypeScript, in-memory data (no DB)   | :3000 |
| Frontend | Angular 20 (standalone components, zone.js change detection)| :4200 |
| Package manager | pnpm (both sides)                                    |       |

## Project Structure

```
posts-app/
├── backend/
│   └── src/
│       ├── server.ts              # Entry — listens on PORT env or 3000
│       ├── app.ts                 # Express app (cors, json, router, error handlers)
│       ├── types.ts               # Post & PostInput interfaces
│       ├── data.ts                # In-memory store (array) with CRUD helpers + 1 seed post
│       ├── routes/
│       │   └── posts.routes.ts    # GET / | GET /:id | POST / | PUT /:id | DELETE /:id
│       ├── controllers/
│       │   └── posts.controller.ts  # Thin handlers that call data.ts
│       └── middleware/
│           ├── validatePost.ts    # Single source of truth for backend validation
│           └── errorHandler.ts    # 404 catch-all + 500 global error handler
│
├── frontend/
│   ├── angular.json               # Application builder, SCSS styles, zone.js polyfill
│   └── src/
│       ├── index.html             # <app-root>
│       ├── main.ts                # bootstrapApplication(AppComponent, appConfig)
│       ├── styles.scss            # Global styles (cards, buttons, inputs, errors)
│       ├── environments/
│       │   └── environment.ts     # { apiUrl: 'http://localhost:3000/api' }
│       └── app/
│           ├── app.component.ts   # Shell — <h1>Posts</h1> + <router-outlet>
│           ├── app.config.ts      # provideRouter + provideHttpClient
│           ├── app.routes.ts      # '' → PostList | 'new' → PostForm | 'edit/:id' → PostForm
│           ├── models/
│           │   └── post.model.ts  # Post & PostInput interfaces (mirrors backend types)
│           ├── services/
│           │   └── post.service.ts  # HttpClient CRUD (getAll, getOne, create, update, remove)
│           └── components/
│               ├── post-list/     # .component.ts + .component.html
│               └── post-form/     # .component.ts + .component.html (create + edit)
│
└── CLAUDE.md
```

## Commands

```bash
# Backend
cd backend && pnpm install && pnpm dev     # ts-node-dev → :3000

# Frontend
cd frontend && pnpm install && pnpm start  # ng serve → :4200
```

## API Contract

Base URL: `http://localhost:3000/api/posts`

| Method | Path        | Body             | Success          | Error                                    |
|--------|-------------|------------------|------------------|------------------------------------------|
| GET    | /           | — (query: `page`, `limit`) | 200 `Paginated<Post>` | 500                          |
| GET    | /:id        | —                | 200 `Post`       | 404 `{ message }`                        |
| POST   | /           | `{ title, body }`| 201 `Post`       | 400 `{ message, errors }` · 500          |
| PUT    | /:id        | `{ title, body }`| 200 `Post`       | 400 `{ message, errors }` · 404 · 500   |
| DELETE | /:id        | —                | 204 (no body)    | 404 `{ message }` · 500                  |

`GET /` is paginated: `page` defaults to 1 (min 1), `limit` defaults to 10 (min 1, max 100).

### Response shapes

```ts
// Post
{ id: string, title: string, body: string, createdAt: string, updatedAt: string }

// Paginated<Post> — GET / envelope
{ data: Post[], total: number, page: number, totalPages: number }

// Validation error (400)
{ message: "Validation failed", errors: { title?: string, body?: string } }

// Not found (404)
{ message: "Post not found" }   // or "Route not found" for unknown paths
```

## Validation Rules (keep in sync!)

| Field | Rule                                   | Backend location            | Frontend location           |
|-------|----------------------------------------|-----------------------------|-----------------------------|
| title | required, min 3 chars (trimmed string) | `middleware/validatePost.ts` | PostFormComponent `trimmedMinLength(3)` |
| body  | required, min 10 chars (trimmed string)| `middleware/validatePost.ts` | PostFormComponent `trimmedMinLength(10)` |

Both sides measure length **after trimming**, so whitespace-only input is rejected as
required on the client and the server alike.

**Critical:** When changing validation, update **both** `validatePost.ts` (backend) and the
`Validators` in `post-form.component.ts` (frontend). Error messages shown to the user come
from both client-side validators _and_ server-side `errors` object (displayed next to matching field).

## Conventions

- **TypeScript strict mode** on both sides.
- **Backend:** Controllers stay thin — call `data.ts` for storage. Validation lives _only_
  in `middleware/validatePost.ts`. Always return correct status codes (200/201/204/400/404/500)
  with `{ message, errors? }` JSON shape.
- **Frontend:** Standalone components only (no NgModules). Reactive forms with `Validators`.
  Every API call handles `loading` + `error` state in the component. Server 400 `errors` object
  must be shown next to the matching field.
- **Styling:** Global SCSS in `styles.scss`. Utility classes: `.container`, `.card`, `.error`,
  `.btn-primary`, `.btn-danger`, `.btn-secondary`. No CSS framework.
- **Routing:** Three routes — list (`''`), create (`'new'`), edit (`'edit/:id'`).
  PostFormComponent is reused for both create and edit (detects `id` param).

## Gotchas & Important Notes

- **zone.js polyfill is required.** Angular 20 with the `application` builder needs
  `"polyfills": ["zone.js"]` in `angular.json`. Without it the app renders a blank page
  (error NG0908).
- **In-memory data resets on backend restart.** There is no database — the `posts` array
  in `data.ts` lives in memory. One seed post is created on startup.
- **CORS is wide open** (`cors()` with no config) — fine for local dev only.
- **No auth, no state management library, no database** — don't add these unless asked.
- **There is a junk directory** at `frontend/src/app/{models,services,components` (literal
  brace in directory name). It's empty/unused and can be safely deleted.

## When asked to change something

- Keep diffs minimal — don't restructure unrelated files.
- No new dependencies unless asked.
- After any backend route/validation change, check the matching frontend form/service
  still matches the contract.
- Don't add a database, auth, or state management library unless asked.

## Output style

- Code changes only, no restating unchanged files.
- Short summary of what changed, not a full re-explanation of the app.
