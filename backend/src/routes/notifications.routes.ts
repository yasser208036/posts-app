import { Router } from "express";
import {
  listNotifications,
  dismissNotification,
} from "../controllers/notifications.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, listNotifications);
router.delete("/comments/:commentId", requireAuth, dismissNotification);

export default router;
