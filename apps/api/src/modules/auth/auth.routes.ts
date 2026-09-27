import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as controller from "./auth.controller";
import { requireAuth } from "../../middleware/auth";

const router = Router();

// Protege login/registo contra força bruta e enumeração de contas.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

router.post("/register", authLimiter, controller.register);
router.post("/login", authLimiter, controller.login);
router.post("/refresh", authLimiter, controller.refresh);
router.post("/logout", controller.logout);
router.get("/me", requireAuth, controller.me);

export default router;
