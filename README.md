# Posts App

CRUD app for posts (title + body). Backend: Node.js/Express/TypeScript with
in-memory mock data. Frontend: Angular (standalone components).

## Structure
```
posts-app/
  backend/   # Express API
  frontend/  # Angular app
```

## Run the backend
```bash
cd backend
pnpm install
pnpm dev        # http://localhost:3000
```

## Run the frontend
```bash
cd frontend
pnpm install
pnpm start       # http://localhost:4200
```

Make sure the backend is running first — the frontend calls
`http://localhost:3000/api` (see `frontend/src/environments/environment.ts`).

## API

| Method | Endpoint          | Body                      | Notes                     |
|--------|-------------------|---------------------------|----------------------------|
| GET    | /api/posts        | -                          | list all posts            |
| GET    | /api/posts/:id     | -                          | 404 if not found           |
| POST   | /api/posts        | `{ title, body }`         | 201 / 400 on invalid       |
| PUT    | /api/posts/:id     | `{ title, body }`         | 200 / 400 / 404            |
| DELETE | /api/posts/:id     | -                          | 204 / 404                  |

## Validation rules
- `title`: required, min 3 chars
- `body`: required, min 10 chars

Applied on both client (Angular reactive form) and server
(`validatePost` middleware) — server is the source of truth, client is UX.

## Quick test
```bash
curl http://localhost:3000/api/posts
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","body":"This is my first post body"}'
```
