import { Router } from "express";
import * as controller from "./availability.controller";

// Montado em /branches/:branchId/availability (mergeParams para herdar :branchId).
const router = Router({ mergeParams: true });

router.get("/", controller.list);

export default router;
