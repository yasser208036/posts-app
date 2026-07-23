import jwt from "jsonwebtoken";
import { JwtPayload } from "../types";

// Resolve the signing secret once at module load. In production a missing
// JWT_SECRET is a hard failure (never sign tokens with a publicly-known key);
// in dev we fall back with a loud warning so local runs still work.
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[jwt] JWT_SECRET is required in production and was not set.",
    );
  }

  console.warn(
    "[jwt] WARNING: JWT_SECRET env var is not set. Using an insecure dev-only fallback. " +
      "Set JWT_SECRET in your .env file for production.",
  );
  return "dev-only-insecure-secret";
}

const JWT_SECRET = resolveJwtSecret();

const EXPIRES_IN = "7d";

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, JWT_SECRET) as JwtPayload;
