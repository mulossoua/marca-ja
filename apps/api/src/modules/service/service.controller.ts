import type { NextFunction, Request, Response } from "express";
import * as service from "./service.service";
import {
  assignProfessionalsSchema,
  createServiceCategorySchema,
  createServiceSchema,
  updateServiceSchema,
} from "./service.schema";
import { errors } from "../../utils/httpError";

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const { name } = createServiceCategorySchema.parse(req.body);
    const category = await service.createCategory(req.tenant.branchId, name);
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    res.json(await service.listCategories(req.tenant.branchId));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const input = createServiceSchema.parse(req.body);
    const created = await service.createService(req.tenant.branchId, input);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// Rota autenticada (gestão): pode incluir serviços inactivos.
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const includeInactive = req.query.all === "true";
    res.json(await service.listServices(req.tenant.branchId, includeInactive));
  } catch (err) {
    next(err);
  }
}

// Rota pública (perfil do estabelecimento no app do cliente): só serviços activos,
// sem exigir autenticação nem membership — usa directamente o :branchId do URL.
export async function listPublic(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listServices(req.params.branchId, false));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const input = updateServiceSchema.parse(req.body);
    const updated = await service.updateService(req.tenant.branchId, req.params.serviceId, input, req.auth?.userId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    await service.deactivateService(req.tenant.branchId, req.params.serviceId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function assignProfessionals(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const { professionalIds } = assignProfessionalsSchema.parse(req.body);
    const result = await service.assignProfessionals(req.tenant.branchId, req.params.serviceId, professionalIds);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
