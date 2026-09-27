import { Router } from "express";
import * as controller from "./appointment.controller";
import * as paymentController from "../payment/payment.controller";
import { requireAuth } from "../../middleware/auth";
import { requireBranchAccess } from "../../middleware/tenant";

// Montado em /branches/:branchId/appointments (mergeParams para herdar :branchId).
const router = Router({ mergeParams: true });

// Criar marcação: qualquer cliente autenticado (a filial é pública, não exige membership).
router.post("/", requireAuth, controller.create);

// Gestão pelo estabelecimento: exige ser membro do negócio dono desta filial.
router.get("/", requireAuth, requireBranchAccess(), controller.listBranch);
router.patch("/:appointmentId/status", requireAuth, requireBranchAccess(), controller.staffTransition);
router.patch("/:appointmentId/payment/received", requireAuth, requireBranchAccess(), paymentController.markReceived);

export default router;
