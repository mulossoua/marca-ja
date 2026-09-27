import { Router } from "express";
import * as professionalController from "./professional.controller";
import * as appointmentController from "../appointment/appointment.controller";
import { requireAuth } from "../../middleware/auth";
import { requireProfessionalSelf } from "../../middleware/professionalSelf";

// Auto-serviço do profissional: montado em /me/professional. Nunca aceita
// branchId/professionalId do cliente — resolve sempre "quem sou eu" via requireProfessionalSelf.
const router = Router();

const self = [requireAuth, requireProfessionalSelf()];

router.get("/appointments", ...self, appointmentController.listMyAgenda);
router.patch("/appointments/:appointmentId/status", ...self, appointmentController.professionalTransition);

router.get("/time-blocks", ...self, professionalController.listMyTimeBlocks);
router.post("/time-blocks", ...self, professionalController.createMyTimeBlock);
router.delete("/time-blocks/:timeBlockId", ...self, professionalController.deleteMyTimeBlock);

export default router;
