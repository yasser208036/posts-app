import { Router } from "express";
import {
  listPosts,
  getPost,
  createPost,
  updatePost,
  removePost,
} from "../controllers/posts.controller";
import { validatePost } from "../middleware/validatePost";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", listPosts);
router.get("/:id", getPost);
router.post("/", requireAuth, validatePost, createPost);
router.put("/:id", requireAuth, validatePost, updatePost);
router.delete("/:id", requireAuth, removePost);

export default router;
