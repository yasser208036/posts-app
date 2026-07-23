import { Router } from "express";
import { ping, logout } from "../controllers/presence.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.post("/ping", requireAuth, ping);
router.post("/logout", requireAuth, logout);

export default router;
