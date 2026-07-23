import { Router } from "express";
import {
  acceptRequest,
  listFriends,
  listRequests,
  listSentRequests,
  rejectRequest,
  requestCount,
  sendRequest,
} from "../controllers/friends.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, listFriends);
router.get("/requests", requireAuth, listRequests);
router.get("/requests/count", requireAuth, requestCount);
router.get("/requests/sent", requireAuth, listSentRequests);
router.post("/requests", requireAuth, sendRequest);
router.post("/requests/:id/accept", requireAuth, acceptRequest);
router.post("/requests/:id/reject", requireAuth, rejectRequest);

export default router;
