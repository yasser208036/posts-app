# Story 05 — Authentication system (email/password + Google, JWT sessions)

---

## Prerequisites

- [Story 04 completed](04-story-search-filter.md): `PostListComponent` fetch/pagination/filter flow, `PostService` HTTP CRUD, and the `app.ts` Express wiring this story builds on. No behaviour from Story 04 is removed.
- **New backend dependencies are required and in scope.** Unlike prior stories, `CLAUDE.md`'s "no auth, no new dependencies" rule is explicitly overridden by this story's acceptance criteria (secure hashing, JWT, Google verification). Add exactly the packages listed in **Backend Task 1** — nothing more.
- **Coordinate the shared contract:** this story adds `/api/auth/*` alongside the existing `/api/posts/*` router (`backend/src/app.ts` line 11) and protects the mutating posts routes. Anyone editing `backend/src/routes/posts.routes.ts` must know POST/PUT/DELETE now sit behind `requireAuth`.
- **In-memory store, dev-only, matches the existing app.** Users live in a module-level array exactly like `posts` in `backend/src/data.ts` line 6, and **reset on backend restart** (see `CLAUDE.md` "In-memory data resets"). No database is introduced.

---

## Story Goal

Add a complete authentication layer so a user can register, log in with email/password or Google, receive a JWT, and have that token gate the post-mutation endpoints.

1. **Sign up** with name, email, password — validated (required fields, email format, password strength), rejects duplicate email, hashes the password, returns a JWT + public user (auto-login).
2. **Login** with email/password — validates existence and password, returns a JWT + public user; wrong credentials return a generic error.
3. **Google login** — frontend obtains a Google ID token, backend verifies it, creates the user on first sight or logs in an existing one, returns a JWT.
4. **Protected routes** — `POST/PUT/DELETE /api/posts` require a valid `Authorization: Bearer <token>`; missing/invalid token returns 401.
5. **Frontend** — `/login` and `/signup` pages, a token stored client-side and attached via an HTTP interceptor, a route guard, and navbar login/logout state.

**Not in scope:** refresh tokens, email verification / password reset, role-based authorization, rate limiting, account settings, persisting users across restarts, and protecting the *read* endpoints (`GET /api/posts`, `GET /api/posts/:id` stay public).

---

## Product rules (from story)

| Behaviour | Current | New |
|---|---|---|
| Post reads (`GET`) | Public | **Unchanged — stay public** |
| Post writes (`POST/PUT/DELETE`) | Public | **Require `Bearer` JWT (401 otherwise)** |
| Users | None | In-memory array, password stored **hashed only** |
| Same email via Google + password | N/A | Treated as **one account** — Google login on an existing email logs into that account (see Edge Cases) |

---

## Context — Read These Files First

1. `backend/src/app.ts` — **lines 1–16**. Router wiring: line 11 `app.use('/api/posts', postsRouter)`. Add the auth router import and `app.use('/api/auth', authRouter)` **before** the `notFoundHandler` (line 13).
2. `backend/src/data.ts` — **lines 1–6, 55–66**. The `posts` module array pattern (line 6) and `createPost` using `randomUUID()` + ISO timestamps (lines 55–66). Mirror this exactly for the users store.
3. `backend/src/types.ts` — **lines 1–25**. Add `User`, `PublicUser`, `AuthResponse`, `JwtPayload` after line 25.
4. `backend/src/middleware/validatePost.ts` — **lines 1–21**. The `{ message, errors }` 400 contract and the `errors: Record<string,string>` shape. New auth validators must return the **identical** shape so the frontend can render per-field errors the same way.
5. `backend/src/routes/posts.routes.ts` — **lines 1–13**. Lines 9–11 (`post`/`put`/`delete`) get a `requireAuth` middleware inserted before `validatePost`.
6. `backend/src/controllers/posts.controller.ts` — **lines 1–2** (imports + `import * as db`). Controller/`db` split to mirror for `auth.controller.ts`.
7. `backend/src/middleware/errorHandler.ts` — **lines 1–11**. `next(err)` → 500 pattern; auth controllers wrap in `try/catch` and call `next(err)` the same way.
8. `frontend/src/app/app.config.ts` — **lines 1–9**. `provideHttpClient()` (line 7) must become `provideHttpClient(withInterceptors([authInterceptor]))`.
9. `frontend/src/app/app.routes.ts` — **lines 1–8**. Add `login`/`signup` routes and wrap `''` with `canActivate: [authGuard]`.
10. `frontend/src/app/app.component.ts` — **lines 53–75** (navbar actions block) and **lines 97–109** (component class). Add login/logout UI + inject `AuthService`.
11. `frontend/src/app/services/post.service.ts` — **lines 1–48**. `Injectable`/`HttpClient`/`environment.apiUrl` pattern (`${environment.apiUrl}/posts`, line 9) to mirror for `AuthService` (`${environment.apiUrl}/auth`).
12. `frontend/src/app/components/post-form/post-form.component.ts` — **lines 1–47, 108–147**. Reactive-form setup with `FormBuilder`, the `trimmedMinLength` validator (lines 9–18), and the 400-error handling that copies `err.error.errors` into `serverErrors` (lines 138–146). Login/signup forms follow this exact structure.
13. `frontend/src/app/components/post-form/post-form.component.html` — read end-to-end for the Tailwind field/error markup to match (labels, inputs, `*ngIf` error blocks). **Styling is Tailwind CSS**, not the SCSS utility classes described in `CLAUDE.md`.
14. `frontend/src/index.html` — `<app-root>` host; the Google Identity Services `<script>` is added here.
15. `frontend/src/environments/environment.ts` — **lines 1–4**. Add `googleClientId` alongside `apiUrl`.
16. `frontend/src/app/models/post.model.ts` — **lines 1–19**. Model style to mirror in `user.model.ts`.

---

## Backend Tasks

### 1 — Add dependencies

**File: `backend/package.json`** (deps block, lines 12–15; devDeps, lines 16–23)

Add to `dependencies` (pinned, exact versions):

```json
"bcryptjs": "2.4.3",
"jsonwebtoken": "9.0.2",
"google-auth-library": "9.15.0"
```

Add to `devDependencies`:

```json
"@types/bcryptjs": "2.4.6",
"@types/jsonwebtoken": "9.0.6"
```

Run `cd backend && pnpm install`. These are well-known, actively maintained packages; do **not** substitute look-alike names.

---

### 2 — User types

**File: `backend/src/types.ts`** — append after line 25:

```ts
export type AuthProvider = "local" | "google";

export interface User {
  id: string;
  name: string;
  email: string; // stored lowercased
  passwordHash: string | null; // null for google-only accounts
  provider: AuthProvider; // how the account was first created
  createdAt: string;
}

// User shape safe to return to clients — never includes passwordHash.
export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
}
```

---

### 3 — In-memory users store

**Create file: `backend/src/users.data.ts`** — mirror `data.ts` (lines 1–6, 55–66):

```ts
import { randomUUID } from "crypto";
import { User, PublicUser, AuthProvider } from "./types";

let users: User[] = [];

export const findUserByEmail = (email: string): User | undefined =>
  users.find((u) => u.email === email.trim().toLowerCase());

export const findUserById = (id: string): User | undefined =>
  users.find((u) => u.id === id);

export const createUser = (input: {
  name: string;
  email: string;
  passwordHash: string | null;
  provider: AuthProvider;
}): User => {
  const user: User = {
    id: randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash: input.passwordHash,
    provider: input.provider,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
};

export const toPublicUser = (u: User): PublicUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
});
```

---

### 4 — Password + JWT helpers

**Create file: `backend/src/auth/password.ts`**:

```ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = (
  plain: string,
  hash: string,
): Promise<boolean> => bcrypt.compare(plain, hash);
```

**Create file: `backend/src/auth/jwt.ts`**:

```ts
import jwt from "jsonwebtoken";
import { JwtPayload } from "../types";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-insecure-secret";
const EXPIRES_IN = "7d";

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, JWT_SECRET) as JwtPayload;
```

- The fallback secret keeps local dev running without env setup, matching the app's dev-only posture (`CLAUDE.md`: "CORS is wide open — fine for local dev only"). Document `JWT_SECRET` as the production override in a code comment.

---

### 5 — Auth request validation

**Create file: `backend/src/middleware/validateAuth.ts`** — reuse the exact 400 shape from `validatePost.ts` (lines 6, 16–18):

```ts
import { Request, Response, NextFunction } from "express";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(req: Request, res: Response, next: NextFunction) {
  const { name, email, password } = req.body ?? {};
  const errors: Record<string, string> = {};

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.name = "Name is required and must be at least 2 characters.";
  }
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    errors.email = "A valid email is required.";
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    errors.password = "Password is required and must be at least 8 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }
  next();
}

export function validateLogin(req: Request, res: Response, next: NextFunction) {
  const { email, password } = req.body ?? {};
  const errors: Record<string, string> = {};

  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    errors.email = "A valid email is required.";
  }
  if (!password || typeof password !== "string" || password.length === 0) {
    errors.password = "Password is required.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }
  next();
}
```

- **Password strength** = min 8 chars (matches the frontend validator in Task 11). Keep both sides in sync exactly like the existing `title`/`body` rules.

---

### 6 — `requireAuth` middleware

**Create file: `backend/src/middleware/requireAuth.ts`**:

```ts
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth/jwt";
import { findUserById } from "../users.data";

// Augment Express Request with the authenticated user id.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyToken(token);
    if (!findUserById(payload.sub)) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
```

---

### 7 — Auth controller

**Create file: `backend/src/controllers/auth.controller.ts`** — mirror the `try/catch → next(err)` pattern from `posts.controller.ts` (lines 4–35):

```ts
import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import * as users from "../users.data";
import { hashPassword, verifyPassword } from "../auth/password";
import { signToken } from "../auth/jwt";
import { AuthResponse } from "../types";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function authResponse(user: {
  id: string;
  name: string;
  email: string;
}): AuthResponse {
  return {
    token: signToken({ sub: user.id, email: user.email }),
    user: { id: user.id, name: user.name, email: user.email },
  };
}

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body;
    if (users.findUserByEmail(email)) {
      return res
        .status(409)
        .json({ message: "Validation failed", errors: { email: "Email already exists" } });
    }
    const passwordHash = await hashPassword(password);
    const user = users.createUser({ name, email, passwordHash, provider: "local" });
    res.status(201).json(authResponse(user));
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const user = users.findUserByEmail(email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    res.status(200).json(authResponse(user));
  } catch (err) {
    next(err);
  }
}

export async function googleLogin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { credential } = req.body ?? {};
    if (typeof credential !== "string" || !credential) {
      return res.status(400).json({ message: "Missing Google credential" });
    }
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(401).json({ message: "Invalid Google token" });
    }
    let user = users.findUserByEmail(payload.email);
    if (!user) {
      user = users.createUser({
        name: payload.name ?? payload.email,
        email: payload.email,
        passwordHash: null,
        provider: "google",
      });
    }
    res.status(200).json(authResponse(user));
  } catch (err) {
    next(err);
  }
}

export function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.userId ? users.findUserById(req.userId) : undefined;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    res.status(200).json(users.toPublicUser(user));
  } catch (err) {
    next(err);
  }
}
```

- **Duplicate email** returns **409** with the same `{ message, errors }` shape so the frontend renders `errors.email` = "Email already exists" (matches AC).
- **Login failures** return a **generic** 401 "Invalid credentials" — never reveal whether the email exists.

---

### 8 — Auth routes

**Create file: `backend/src/routes/auth.routes.ts`** — mirror `posts.routes.ts` (lines 1–13):

```ts
import { Router } from "express";
import { signup, login, googleLogin, me } from "../controllers/auth.controller";
import { validateSignup, validateLogin } from "../middleware/validateAuth";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.post("/signup", validateSignup, signup);
router.post("/login", validateLogin, login);
router.post("/google", googleLogin);
router.get("/me", requireAuth, me);

export default router;
```

---

### 9 — Wire the router and protect post mutations

**File: `backend/src/app.ts`** — add import after line 3 and mount after line 11:

```ts
import authRouter from "./routes/auth.routes";
// ...
app.use("/api/auth", authRouter);
```

**File: `backend/src/routes/posts.routes.ts`** — import `requireAuth` (after line 3) and insert it as the first middleware on the mutating routes (lines 9–11):

```ts
import { requireAuth } from "../middleware/requireAuth";
// ...
router.post("/", requireAuth, validatePost, createPost);
router.put("/:id", requireAuth, validatePost, updatePost);
router.delete("/:id", requireAuth, removePost);
```

Leave `router.get("/", listPosts)` and `router.get("/:id", getPost)` **public** (lines 7–8 unchanged).

---

## Frontend Tasks

### 10 — User model, environment, HTTP interceptor, guard

**Create file: `frontend/src/app/models/user.model.ts`** (mirror `post.model.ts`):

```ts
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
```

**File: `frontend/src/environments/environment.ts`** — add the client id:

```ts
export const environment = {
  apiUrl: "http://localhost:3000/api",
  googleClientId: "REPLACE_WITH_GOOGLE_CLIENT_ID",
};
```

**Create file: `frontend/src/app/interceptors/auth.interceptor.ts`**:

```ts
import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { AuthService } from "../services/auth.service";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token;
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};
```

**Create file: `frontend/src/app/guards/auth.guard.ts`**:

```ts
import { CanActivateFn, Router } from "@angular/router";
import { inject } from "@angular/core";
import { AuthService } from "../services/auth.service";

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated ? true : router.createUrlTree(["/login"]);
};
```

---

### 11 — Auth service

**Create file: `frontend/src/app/services/auth.service.ts`** — mirror `PostService` (lines 1–11) for the `HttpClient`/`environment.apiUrl` base:

```ts
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable, tap } from "rxjs";
import { environment } from "../../environments/environment";
import { AuthResponse, AuthUser } from "../models/user.model";

const TOKEN_KEY = "posts_auth_token";
const USER_KEY = "posts_auth_user";

@Injectable({ providedIn: "root" })
export class AuthService {
  private baseUrl = `${environment.apiUrl}/auth`;
  private _token: string | null = localStorage.getItem(TOKEN_KEY);
  private userSubject = new BehaviorSubject<AuthUser | null>(
    this.readStoredUser(),
  );
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {}

  get token(): string | null {
    return this._token;
  }
  get isAuthenticated(): boolean {
    return !!this._token;
  }

  signup(body: {
    name: string;
    email: string;
    password: string;
  }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/signup`, body)
      .pipe(tap((res) => this.persist(res)));
  }

  login(body: { email: string; password: string }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, body)
      .pipe(tap((res) => this.persist(res)));
  }

  googleLogin(credential: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/google`, { credential })
      .pipe(tap((res) => this.persist(res)));
  }

  logout(): void {
    this._token = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSubject.next(null);
  }

  private persist(res: AuthResponse): void {
    this._token = res.token;
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.userSubject.next(res.user);
  }

  private readStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }
}
```

---

### 12 — Login & signup components

**Create files:** `frontend/src/app/components/login/login.component.ts` (+ `.html`) and `frontend/src/app/components/signup/signup.component.ts` (+ `.html`).

Follow `post-form.component.ts` (lines 1–47, 108–147) precisely:
- Standalone, `imports: [CommonModule, ReactiveFormsModule]`.
- `FormBuilder` group. **Signup:** `name` `[Validators.required, Validators.minLength(2)]`, `email` `[Validators.required, Validators.email]`, `password` `[Validators.required, Validators.minLength(8)]` (**mirrors backend Task 5**). **Login:** `email` + `password` required.
- `submitting`, `errorMessage`, `serverErrors: Record<string,string>` state.
- On submit: call `AuthService.signup/login`; on success `router.navigate(["/"])`; on `400`/`409` copy `err.error.errors` into `serverErrors`, else set a generic `errorMessage` (same as `post-form` lines 138–146). Login's 401 sets `errorMessage = "Invalid credentials"`.
- Markup: match the Tailwind label/input/error classes in `post-form.component.html`. Include a link between the two pages (`routerLink="/signup"` / `routerLink="/login"`).

**Google button (both pages):** render `<div id="googleBtn"></div>`. In `ngAfterViewInit`, call `google.accounts.id.initialize({ client_id: environment.googleClientId, callback })` and `google.accounts.id.renderButton(...)`; the callback passes `response.credential` to `AuthService.googleLogin(...)` then navigates home. Declare `declare const google: any;` at the top of each component file (the script is loaded in Task 14).

---

### 13 — Routes, interceptor registration, navbar

**File: `frontend/src/app/app.config.ts`** — replace line 3 import and line 7:

```ts
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { authInterceptor } from "./interceptors/auth.interceptor";
// ...
providers: [
  provideRouter(routes),
  provideHttpClient(withInterceptors([authInterceptor])),
],
```

**File: `frontend/src/app/app.routes.ts`** — add auth routes and guard the list:

```ts
import { authGuard } from "./guards/auth.guard";
import { LoginComponent } from "./components/login/login.component";
import { SignupComponent } from "./components/signup/signup.component";

export const routes: Routes = [
  { path: "", component: PostListComponent, canActivate: [authGuard] },
  { path: "login", component: LoginComponent },
  { path: "signup", component: SignupComponent },
  { path: "**", redirectTo: "" },
];
```

**File: `frontend/src/app/app.component.ts`** — inject `AuthService` (constructor, line 98–101), add `RouterLink` is already imported (line 2). In the navbar actions block (lines 53–75), show the "New Post" button + user name + a **Logout** button when `auth.user$ | async` is truthy, and **Login**/**Sign up** `routerLink`s otherwise. Add a `logout()` method calling `this.auth.logout()` then `this.router.navigate(["/login"])`. Import `AsyncPipe` (add `CommonModule` or `AsyncPipe` to `imports`, currently `[RouterOutlet, RouterLink]` line 8).

---

### 14 — Google Identity Services script

**File: `frontend/src/index.html`** — add inside `<head>`:

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

---

## Edge Cases & Failure Modes

- **Duplicate email on signup** → `auth.controller.ts signup` returns **409** `{ errors: { email: "Email already exists" } }`; frontend renders it under the email field (Task 12).
- **Login with wrong password or unknown email** → generic **401** "Invalid credentials" (`login`, no user-existence leak).
- **Login against a Google-only account** (`passwordHash === null`) → `login` returns 401 (the `!user.passwordHash` guard), so a Google user cannot password-login until they set one (out of scope).
- **Same email via Google then password (or vice-versa)** → `googleLogin` finds the existing account by lowercased email and logs into it rather than creating a duplicate; email is always normalized in `createUser`/`findUserByEmail` (`users.data.ts`). This satisfies the AC "Same email used for Google and email/password login".
- **Missing/invalid/expired Bearer token on a protected route** → `requireAuth` returns **401**; the frontend has no global 401→logout handler in this story, so the failing request surfaces its error via the component's existing error state. Note this explicitly for the executor: **a 401 on `POST/PUT/DELETE` will show the component error message, not auto-redirect** (auto-logout on 401 is a documented follow-up, out of scope).
- **Token present but its user no longer exists** (backend restarted, in-memory users cleared) → `requireAuth` rejects with 401 because `findUserById` misses. The stored token in `localStorage` is now stale; user must log in again. This is expected given the in-memory store resets on restart.
- **`GOOGLE_CLIENT_ID` unset on backend** → `googleClient.verifyIdToken` rejects; caught by `try/catch` → `next(err)` → 500. Document that Google login requires the env var; email/password login is unaffected.
- **Whitespace/case in email** → normalized to `trim().toLowerCase()` on both write and lookup, so `Foo@Bar.com ` and `foo@bar.com` are the same account.
- **`JWT_SECRET` unset** → falls back to `"dev-only-insecure-secret"` (dev only). Flag in a comment that production **must** set `JWT_SECRET`.

---

## Test Plan

No test framework exists in either package (`backend` and `frontend` both report `none`; no spec files). Do **not** stand up a full test harness for this story — verify manually per the Verification Steps. Record the following as the manual test matrix to run with backend + frontend both up:

1. **Signup happy path** — POST `/api/auth/signup` with valid name/email/password → 201, body has `token` + `user`; the same email again → 409 with `errors.email`.
2. **Signup validation** — missing/short password, bad email, short name → 400 `{ message, errors }` with the offending fields.
3. **Login happy path / failure** — correct creds → 200 + token; wrong password and unknown email → 401 "Invalid credentials".
4. **Protected route** — `POST /api/posts` without `Authorization` → 401; with a valid `Bearer` token → 201. `GET /api/posts` with no token → still 200 (public).
5. **Google** — with a real Google ID token (from the rendered button), `POST /api/auth/google` → 200; a second login with the same Google account does not create a duplicate user.
6. **Frontend guard** — visiting `/` while logged out redirects to `/login`; after login it renders the post list; logout returns to `/login` and clears `localStorage`.

If the team later adds a test runner, the natural first targets are `validateAuth.ts`, `auth/password.ts`, and `requireAuth.ts` (pure, no HTTP).

---

## Verification Steps

1. **Backend builds:** `cd backend && pnpm build` — TypeScript strict passes (the `declare global` Request augmentation in `requireAuth.ts` and all new files compile).
2. **Backend runs:** `cd backend && pnpm dev` — API at `http://localhost:3000`; hit `/api/auth/signup` and `/api/auth/login` with `curl` per Test Plan items 1–4.
3. **Frontend runs:** `cd frontend && pnpm start` — compiles with no errors, opens at `http://localhost:4200`, redirects to `/login` when logged out.
4. **Regression:** With a valid token, create/edit/delete a post still works end-to-end; `GET` list + pagination + search/filter (Story 04) still work while logged in.
5. **Env note:** Set `JWT_SECRET` and `GOOGLE_CLIENT_ID` in the backend environment and `googleClientId` in `environment.ts` before testing Google login.

---

## Done Criteria

- [ ] User can sign up with name/email/password; duplicate email is rejected with "Email already exists".
- [ ] Passwords are stored hashed (bcrypt) — `passwordHash` is never returned in any response.
- [ ] Signup validates required fields, email format, and password strength (min 8), on **both** client and server.
- [ ] User can log in with email/password; wrong credentials return a generic "Invalid credentials".
- [ ] Successful signup/login returns a JWT and the frontend stores it and redirects to the list.
- [ ] Google login verifies the ID token server-side, creates-or-logs-in by email, and returns a JWT.
- [ ] `POST/PUT/DELETE /api/posts` require a valid Bearer token (401 otherwise); `GET` endpoints stay public.
- [ ] Frontend attaches the token via an HTTP interceptor and guards the `''` route.
- [ ] Navbar shows the logged-in user + Logout when authenticated, Login/Sign up otherwise.
- [ ] Same email used across Google and email/password resolves to a single account.
- [ ] No look-alike/typosquatted dependencies added; only the pinned packages in Task 1.

**STOP HERE. Report to the user and wait for confirmation before proceeding.**
