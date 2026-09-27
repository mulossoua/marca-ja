import { Router } from "express";
import * as controller from "./notification.controller";
import { requireAuth } from "../../middleware/auth";

const router = Router();

router.get("/mine", requireAuth, controller.listMine);
router.patch("/:notificationId/read", requireAuth, controller.markRead);

export default router;
