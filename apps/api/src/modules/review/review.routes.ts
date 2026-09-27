import { Router } from "express";
import * as controller from "./review.controller";

// Montado em /branches/:branchId/reviews (mergeParams para herdar :branchId).
const router = Router({ mergeParams: true });

router.get("/", controller.listForBranch);

export default router;
