import { Request, Response, NextFunction } from "express";
import { touchLastSeen, clearLastSeen } from "../users.data";

export async function ping(req: Request, res: Response, next: NextFunction) {
  try {
    await touchLastSeen(req.userId!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await clearLastSeen(req.userId!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
