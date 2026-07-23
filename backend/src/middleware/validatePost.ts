import { Request, Response, NextFunction } from "express";

// Validation rules live here so both create & update reuse them.
export function validatePost(req: Request, res: Response, next: NextFunction) {
  const { title, body } = req.body ?? {};
  const errors: Record<string, string> = {};

  if (!title || typeof title !== "string" || title.trim().length < 3) {
    errors.title = "Title is required and must be at least 3 characters.";
  }

  if (!body || typeof body !== "string" || body.trim().length < 10) {
    errors.body = "Body is required and must be at least 10 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }

  next();
}
