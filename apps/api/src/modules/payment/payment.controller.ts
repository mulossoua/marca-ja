import type { NextFunction, Request, Response } from "express";
import * as service from "./payment.service";
import { errors } from "../../utils/httpError";

export async function markReceived(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    res.json(await service.markPaymentReceived(req.tenant.branchId, req.params.appointmentId));
  } catch (err) {
    next(err);
  }
}
