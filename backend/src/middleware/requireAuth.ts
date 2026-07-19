import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth/jwt";
import { findUserById } from "../users.data";
import { User } from "../types";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      // The authenticated user, loaded once here so downstream handlers
      // (e.g. `me`) don't re-query. Only set after requireAuth succeeds.
      user?: User;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = verifyToken(token);
    const user = await findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.userId = user.id;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
