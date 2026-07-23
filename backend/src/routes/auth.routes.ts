import { Router } from "express";
import { signup, login, googleLogin, me } from "../controllers/auth.controller";
import { validateSignup, validateLogin } from "../middleware/validateAuth";
import { requireAuth } from "../middleware/requireAuth";
import { authLimiter } from "../middleware/rateLimit";

const router = Router();

router.post("/signup", authLimiter, validateSignup, signup);
router.post("/login", authLimiter, validateLogin, login);
router.post("/google", authLimiter, googleLogin);
router.get("/me", requireAuth, me);

export default router;
