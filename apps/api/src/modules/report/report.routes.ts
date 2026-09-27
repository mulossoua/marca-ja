import { Router } from "express";
import * as controller from "./report.controller";
import { requireAuth } from "../../middleware/auth";
import { requireBranchAccess } from "../../middleware/tenant";

// Montado em /branches/:branchId/reports (mergeParams para herdar :branchId).
const router = Router({ mergeParams: true });

router.get("/", requireAuth, requireBranchAccess(), controller.get);

export default router;
