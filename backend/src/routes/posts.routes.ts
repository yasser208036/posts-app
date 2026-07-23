import { Router } from "express";
import {
  listPosts,
  getPost,
  createPost,
  updatePost,
  removePost,
} from "../controllers/posts.controller";
import { validatePost } from "../middleware/validatePost";
import { validateComment } from "../middleware/validateComment";
import { requireAuth } from "../middleware/requireAuth";
import {
  createComment,
  getComments,
  updateComment,
  removeComment,
} from "../controllers/comments.controller";

const router = Router();

router.get("/", requireAuth, listPosts);
router.get("/:id", requireAuth, getPost);
router.post("/", requireAuth, validatePost, createPost);
router.put("/:id", requireAuth, validatePost, updatePost);
router.delete("/:id", requireAuth, removePost);

router.get("/:id/comments", requireAuth, getComments);
router.post("/:id/comments", requireAuth, validateComment, createComment);
router.put(
  "/:id/comments/:commentId",
  requireAuth,
  validateComment,
  updateComment,
);
router.delete("/:id/comments/:commentId", requireAuth, removeComment);

export default router;
