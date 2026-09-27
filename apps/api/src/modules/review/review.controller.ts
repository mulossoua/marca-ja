import type { NextFunction, Request, Response } from "express";
import * as service from "./review.service";
import { createReviewSchema } from "./review.schema";
import { errors } from "../../utils/httpError";
import { prisma } from "../../lib/prisma";

async function requireCustomerProfileId(userId: string): Promise<string> {
  const profile = await prisma.customerProfile.findUnique({ where: { userId } });
  if (!profile) throw errors.forbidden("Apenas clientes podem avaliar marcações.");
  return profile.id;
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    const customerId = await requireCustomerProfileId(req.auth.userId);
    const input = createReviewSchema.parse(req.body);
    const review = await service.createReview(req.params.appointmentId, customerId, input);
    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
}

export async function listForBranch(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listBranchReviews(req.params.branchId));
  } catch (err) {
    next(err);
  }
}
