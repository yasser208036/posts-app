import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth/jwt";
import { findUserById } from "../users.data";

declare global {
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
