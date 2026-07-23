import { Request, Response, NextFunction } from "express";
import * as friendsData from "../friends.data";

export async function listUsers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const users = await friendsData.listOtherUsers(req.userId!);
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
}
