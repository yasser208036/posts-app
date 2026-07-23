import { Request, Response, NextFunction } from "express";

// Comments are short, so the floor is 1 char after trimming (vs 10 for a post
// body). Same { message, errors } contract as validatePost.
export function validateComment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { body } = req.body ?? {};
  const errors: Record<string, string> = {};

  if (!body || typeof body !== "string" || body.trim().length < 1) {
    errors.body = "Comment is required.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }

  next();
}
