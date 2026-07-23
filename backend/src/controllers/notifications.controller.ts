import { Request, Response, NextFunction } from "express";
import * as notificationsData from "../notifications.data";

export async function listNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const notifications = await notificationsData.listNotifications(
      req.userId!,
    );
    res.status(200).json(notifications);
  } catch (err) {
    next(err);
  }
}

// Dismisses a comment/reply notification so it no longer surfaces for the
// caller (used when they open the target from the feed). Idempotent → 204.
export async function dismissNotification(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await notificationsData.dismissCommentNotification(
      req.userId!,
      req.params.commentId,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
