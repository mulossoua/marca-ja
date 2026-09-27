import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import * as service from "./professional.service";
import {
  createProfessionalSchema,
  createTimeBlockSchema,
  setAvailabilitySchema,
  updateProfessionalSchema,
} from "./professional.schema";
import { errors } from "../../utils/httpError";

const linkUserSchema = z.object({ email: z.string().email() });

export async function linkUserAccount(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const { email } = linkUserSchema.parse(req.body);
    res.json(await service.linkUserAccount(req.tenant.branchId, req.params.professionalId, email, req.auth?.userId));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const input = createProfessionalSchema.parse(req.body);
    res.status(201).json(await service.createProfessional(req.tenant.branchId, input));
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    res.json(await service.listProfessionals(req.tenant.branchId, req.query.all === "true"));
  } catch (err) {
    next(err);
  }
}

export async function listPublic(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listProfessionals(req.params.branchId, false));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const input = updateProfessionalSchema.parse(req.body);
    res.json(await service.updateProfessional(req.tenant.branchId, req.params.professionalId, input));
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    await service.deactivateProfessional(req.tenant.branchId, req.params.professionalId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function setAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const { slots } = setAvailabilitySchema.parse(req.body);
    res.json(await service.setAvailability(req.tenant.branchId, req.params.professionalId, slots, req.auth?.userId));
  } catch (err) {
    next(err);
  }
}

export async function createTimeBlock(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const input = createTimeBlockSchema.parse(req.body);
    res.status(201).json(await service.createTimeBlock(req.tenant.branchId, req.params.professionalId, input));
  } catch (err) {
    next(err);
  }
}

export async function listTimeBlocks(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    res.json(await service.listTimeBlocks(req.tenant.branchId, req.params.professionalId));
  } catch (err) {
    next(err);
  }
}

export async function deleteTimeBlock(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    await service.deleteTimeBlock(req.tenant.branchId, req.params.professionalId, req.params.timeBlockId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// --- Auto-serviço do profissional (regra 22): usa req.professional, nunca um
// branchId/professionalId vindo do cliente. ---

export async function createMyTimeBlock(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.professional) throw errors.forbidden();
    const input = createTimeBlockSchema.parse(req.body);
    res.status(201).json(await service.createTimeBlock(req.professional.branchId, req.professional.id, input));
  } catch (err) {
    next(err);
  }
}

export async function listMyTimeBlocks(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.professional) throw errors.forbidden();
    res.json(await service.listTimeBlocks(req.professional.branchId, req.professional.id));
  } catch (err) {
    next(err);
  }
}

export async function deleteMyTimeBlock(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.professional) throw errors.forbidden();
    await service.deleteTimeBlock(req.professional.branchId, req.professional.id, req.params.timeBlockId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
