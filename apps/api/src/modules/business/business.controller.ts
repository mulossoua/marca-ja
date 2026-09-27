import type { NextFunction, Request, Response } from "express";
import * as service from "./business.service";
import { createBranchSchema, createBusinessSchema } from "./business.schema";
import { errors } from "../../utils/httpError";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    const input = createBusinessSchema.parse(req.body);
    const business = await service.createBusiness(req.auth.userId, input);
    res.status(201).json(business);
  } catch (err) {
    next(err);
  }
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    const businesses = await service.listMyBusinesses(req.auth.userId);
    res.json(businesses);
  } catch (err) {
    next(err);
  }
}

export async function createBranch(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) throw errors.forbidden();
    const input = createBranchSchema.parse(req.body);
    const branch = await service.createBranch(req.tenant.businessId, input);
    res.status(201).json(branch);
  } catch (err) {
    next(err);
  }
}

export async function listBranches(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) throw errors.forbidden();
    const branches = await service.listBranches(req.tenant.businessId);
    res.json(branches);
  } catch (err) {
    next(err);
  }
}

// Endpoint público (sem auth) para descoberta pelo cliente — regra 6/9/10.
export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const { city, category, q } = req.query;
    const results = await service.searchBranches({
      city: typeof city === "string" ? city : undefined,
      category: typeof category === "string" ? category : undefined,
      query: typeof q === "string" ? q : undefined,
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
}
