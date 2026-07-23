import { Request, Response, NextFunction } from "express";
import * as db from "../data";
import { friendIds } from "../friends.data";

export async function listPosts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string, 10) || 10),
    );

    const title =
      typeof req.query.title === "string" ? req.query.title : undefined;
    const date =
      typeof req.query.date === "string" ? req.query.date : undefined;
    const startDate =
      date ??
      (typeof req.query.startDate === "string"
        ? req.query.startDate
        : undefined);
    const endDate =
      date ??
      (typeof req.query.endDate === "string" ? req.query.endDate : undefined);

    // The list surfaces the caller's own posts plus their accepted friends'.
    // friendIds excludes the caller, so prepend req.userId to include own posts.
    const ids = await friendIds(req.userId!);
    const { data, total } = await db.getPaginatedPosts(
      [req.userId!, ...ids],
      page,
      limit,
      {
        title,
        startDate,
        endDate,
      },
    );
    const totalPages = Math.ceil(total / limit);
    res.status(200).json({ data, total, page, totalPages });
  } catch (err) {
    next(err);
  }
}

export async function getPost(req: Request, res: Response, next: NextFunction) {
  try {
    const post = await db.getPostById(req.userId!, req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
}

export async function createPost(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { title, body } = req.body;
    const post = await db.createPost(req.userId!, { title, body });
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
}

export async function updatePost(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { title, body } = req.body;
    const updated = await db.updatePost(req.userId!, req.params.id, {
      title,
      body,
    });
    if (!updated) return res.status(404).json({ message: "Post not found" });
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function removePost(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const deleted = await db.deletePost(req.userId!, req.params.id);
    if (!deleted) return res.status(404).json({ message: "Post not found" });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
