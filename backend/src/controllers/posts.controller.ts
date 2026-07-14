import { Request, Response, NextFunction } from 'express';
import * as db from '../data';

export function listPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const { data, total } = db.getPaginatedPosts(page, limit);
    const totalPages = Math.ceil(total / limit);
    res.status(200).json({ data, total, page, totalPages });
  } catch (err) {
    next(err);
  }
}

export function getPost(req: Request, res: Response, next: NextFunction) {
  try {
    const post = db.getPostById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
}

export function createPost(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, body } = req.body;
    const post = db.createPost({ title, body });
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
}

export function updatePost(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, body } = req.body;
    const updated = db.updatePost(req.params.id, { title, body });
    if (!updated) return res.status(404).json({ message: 'Post not found' });
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export function removePost(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = db.deletePost(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Post not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
