import { Router } from "express";
import * as controller from "./appointment.controller";
import * as reviewController from "../review/review.controller";
import { requireAuth } from "../../middleware/auth";

// Auto-serviço do cliente: montado em /appointments (não escopado por filial —
// a posse é verificada por customerId dentro do serviço, não pelo URL).
const router = Router();

router.get("/mine", requireAuth, controller.listMine);
router.post("/:appointmentId/cancel", requireAuth, controller.cancel);
router.post("/:appointmentId/reschedule", requireAuth, controller.reschedule);
router.post("/:appointmentId/review", requireAuth, reviewController.create);

export default router;
