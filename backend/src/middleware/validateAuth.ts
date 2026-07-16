import { Request, Response, NextFunction } from "express";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(
  req: Request,
  res: Response,
  next: NextFunction,
) {
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
