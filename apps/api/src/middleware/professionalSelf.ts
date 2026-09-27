import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { errors } from "../utils/httpError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      professional?: { id: string; branchId: string };
    }
  }
}

// Resolve o Professional ligado ao utilizador autenticado (regra 22: o profissional
// só pode consultar/gerir a sua própria agenda, nunca a de outro colega — a
// autoridade é o vínculo User↔Professional na BD, não algo vindo do URL/corpo).
export function requireProfessionalSelf() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(errors.unauthorized());

    const professional = await prisma.professional.findUnique({
      where: { userId: req.auth.userId },
      select: { id: true, branchId: true, isActive: true },
    });

    if (!professional || !professional.isActive) {
      return next(errors.forbidden("Esta conta não está associada a um perfil de profissional activo."));
    }

    req.professional = { id: professional.id, branchId: professional.branchId };
    next();
  };
}
