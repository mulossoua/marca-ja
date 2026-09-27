import { Router } from "express";
import * as controller from "./favourite.controller";
import { requireAuth } from "../../middleware/auth";

const router = Router();

router.get("/mine", requireAuth, controller.listMine);
router.post("/", requireAuth, controller.create);
router.delete("/:favouriteId", requireAuth, controller.remove);

export default router;
