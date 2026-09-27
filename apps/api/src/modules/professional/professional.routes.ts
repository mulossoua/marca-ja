import { Router } from "express";
import * as controller from "./professional.controller";
import { requireAuth } from "../../middleware/auth";
import { requireBranchAccess } from "../../middleware/tenant";

// Montado em /branches/:branchId/professionals (mergeParams para herdar :branchId).
const router = Router({ mergeParams: true });

// Ver nota em service.routes.ts: a autoridade é o membership (BD), não a role do JWT.
const manage = [requireAuth, requireBranchAccess()];

router.get("/public", controller.listPublic);

router.get("/", ...manage, controller.list);
router.post("/", ...manage, controller.create);
router.patch("/:professionalId", ...manage, controller.update);
router.delete("/:professionalId", ...manage, controller.deactivate);

router.put("/:professionalId/availability", ...manage, controller.setAvailability);
router.patch("/:professionalId/link-user", ...manage, controller.linkUserAccount);

router.get("/:professionalId/time-blocks", ...manage, controller.listTimeBlocks);
router.post("/:professionalId/time-blocks", ...manage, controller.createTimeBlock);
router.delete("/:professionalId/time-blocks/:timeBlockId", ...manage, controller.deleteTimeBlock);

export default router;
