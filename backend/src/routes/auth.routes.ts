import { Router } from "express";
import { signup, login, googleLogin, me } from "../controllers/auth.controller";
import { validateSignup, validateLogin } from "../middleware/validateAuth";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.post("/signup", validateSignup, signup);
router.post("/login", validateLogin, login);
router.post("/google", googleLogin);
router.get("/me", requireAuth, me);

export default router;
