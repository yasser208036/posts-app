import { Request, Response, NextFunction } from "express";
import * as db from "../data";
import { friendIds } from "../friends.data";

// A caller may comment on a post they own or a friend owns; anything else
// answers 404 (existence not leaked — CLAUDE.md 404-not-403 rule).
export async function createComment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const ids = await friendIds(req.userId!);
    const post = await db.canCommentOnPost(req.userId!, req.params.id, ids);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = await db.addComment(req.params.id, req.userId!, {
      body: req.body.body,
      parentId:
        typeof req.body.parentId === "string" ? req.body.parentId : undefined,
    });
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
}

export async function getComments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const ids = await friendIds(req.userId!);
    const post = await db.canCommentOnPost(req.userId!, req.params.id, ids);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comments = await db.listComments(req.params.id);
    res.status(200).json(comments);
  } catch (err) {
    next(err);
  }
}

// Edit is author-scoped: the post gate answers 404 for a post the caller can no
// longer see, and updateComment answers 404 for a comment they didn't author.
export async function updateComment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const ids = await friendIds(req.userId!);
    const post = await db.canCommentOnPost(req.userId!, req.params.id, ids);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const updated = await db.updateComment(
      req.userId!,
      req.params.commentId,
      req.body.body,
    );
    if (!updated) return res.status(404).json({ message: "Comment not found" });
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function removeComment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const ids = await friendIds(req.userId!);
    const post = await db.canCommentOnPost(req.userId!, req.params.id, ids);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const deleted = await db.deleteComment(req.userId!, req.params.commentId);
    if (!deleted) return res.status(404).json({ message: "Comment not found" });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
