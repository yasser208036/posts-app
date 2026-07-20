import { Request, Response, NextFunction } from "express";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: "Route not found" });
}

// Express recognizes 4-arg functions as error handlers.
// The `_next` parameter is required to signal Express this is an error handler (4 params).
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}
