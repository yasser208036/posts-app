import { Router } from "express";
import { listUsers } from "../controllers/users.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, listUsers);

export default router;
