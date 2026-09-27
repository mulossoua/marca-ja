import { Router } from "express";
import * as controller from "./service.controller";
import { requireAuth } from "../../middleware/auth";
import { requireBranchAccess } from "../../middleware/tenant";

// Montado em /branches/:branchId/services (mergeParams para herdar :branchId).
const router = Router({ mergeParams: true });

// A autoridade é o BusinessMember verificado em requireBranchAccess (consulta a BD
// em tempo real), não a claim "role" do JWT, que fica desactualizada após uma promoção
// a BUSINESS_MANAGER até o próximo login/refresh.
const manage = [requireAuth, requireBranchAccess()];

router.get("/public", controller.listPublic);

router.get("/", ...manage, controller.list);
router.post("/", ...manage, controller.create);
router.patch("/:serviceId", ...manage, controller.update);
router.delete("/:serviceId", ...manage, controller.deactivate);
router.put("/:serviceId/professionals", ...manage, controller.assignProfessionals);

router.get("/categories", ...manage, controller.listCategories);
router.post("/categories", ...manage, controller.createCategory);

export default router;
