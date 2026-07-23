import express from "express";
import cors from "cors";
import helmet from "helmet";

import postsRouter from "./routes/posts.routes";
import authRouter from "./routes/auth.routes";
import usersRouter from "./routes/users.routes";
import friendsRouter from "./routes/friends.routes";
import presenceRouter from "./routes/presence.routes";
import notificationsRouter from "./routes/notifications.routes";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

const app = express();

// Baseline security headers (CSP, X-Frame-Options, etc.).
app.use(helmet());

// Restrict cross-origin access to the configured frontend origin(s). Set
// CORS_ORIGIN (comma-separated) in production; falls back to the local Angular
// dev server when unset.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:4200")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Cap the request body so an oversized payload can't exhaust memory. Posts and
// comments are small text, so 100kb is generous.
app.use(express.json({ limit: "100kb" }));

app.use("/api/auth", authRouter);
app.use("/api/posts", postsRouter);
app.use("/api/users", usersRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/presence", presenceRouter);
app.use("/api/notifications", notificationsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
