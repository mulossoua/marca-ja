import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import * as service from "./appointment.service";
import { cancelAppointmentSchema, createAppointmentSchema, rescheduleAppointmentSchema } from "./appointment.schema";
import { errors } from "../../utils/httpError";
import { prisma } from "../../lib/prisma";

async function requireCustomerProfileId(userId: string): Promise<string> {
  const profile = await prisma.customerProfile.findUnique({ where: { userId } });
  if (!profile) throw errors.forbidden("Apenas clientes podem efectuar marcações.");
  return profile.id;
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    const customerId = await requireCustomerProfileId(req.auth.userId);
    const input = createAppointmentSchema.parse(req.body);
    const appointment = await service.createAppointment(req.params.branchId, customerId, input);
    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    const customerId = await requireCustomerProfileId(req.auth.userId);
    const { reason } = cancelAppointmentSchema.parse(req.body ?? {});
    const appointment = await service.cancelAppointment(req.params.appointmentId, customerId, reason);
    res.json(appointment);
  } catch (err) {
    next(err);
  }
}

export async function reschedule(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    const customerId = await requireCustomerProfileId(req.auth.userId);
    const { startsAt } = rescheduleAppointmentSchema.parse(req.body);
    const appointment = await service.rescheduleAppointment(req.params.appointmentId, customerId, startsAt);
    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    const customerId = await requireCustomerProfileId(req.auth.userId);
    res.json(await service.listMyAppointments(customerId));
  } catch (err) {
    next(err);
  }
}

const staffTransitionSchema = z.object({
  status: z.enum(["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "NO_SHOW"]),
});

export async function staffTransition(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const { status } = staffTransitionSchema.parse(req.body);
    const appointment = await service.transitionAppointmentByStaff(
      { branchId: req.tenant.branchId },
      req.params.appointmentId,
      status,
    );
    res.json(appointment);
  } catch (err) {
    next(err);
  }
}

export async function listBranch(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant?.branchId) throw errors.forbidden();
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    res.json(await service.listBranchAppointments(req.tenant.branchId, date));
  } catch (err) {
    next(err);
  }
}

// --- Auto-serviço do profissional (regra 22) ---

export async function listMyAgenda(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.professional) throw errors.forbidden();
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    res.json(await service.listProfessionalAppointments(req.professional.id, date));
  } catch (err) {
    next(err);
  }
}

export async function professionalTransition(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.professional) throw errors.forbidden();
    const { status } = staffTransitionSchema.parse(req.body);
    const appointment = await service.transitionAppointmentByStaff(
      { branchId: req.professional.branchId, professionalId: req.professional.id },
      req.params.appointmentId,
      status,
    );
    res.json(appointment);
  } catch (err) {
    next(err);
  }
}
