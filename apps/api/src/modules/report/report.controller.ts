import type { NextFunction, Request, Response } from "express";
import * as service from "./report.service";
import { reportRangeSchema } from "./report.schema";
import { errors } from "../../utils/httpError";

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const input = reportRangeSchema.parse(req.query);
    res.json(await service.getBranchReport(req.tenant.branchId, input));
  } catch (err) {
    next(err);
  }
}
