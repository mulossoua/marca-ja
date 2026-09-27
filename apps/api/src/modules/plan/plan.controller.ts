import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import * as service from "./plan.service";

export function list(_req: Request, res: Response) {
  res.json(service.listPlans());
}

const changePlanSchema = z.object({ planCode: z.enum(["starter", "professional", "business"]) });

export async function changePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const { planCode } = changePlanSchema.parse(req.body);
    res.json(await service.changeBusinessPlan(req.params.businessId, planCode, req.auth?.userId));
  } catch (err) {
    next(err);
  }
}
