import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { errors } from "../utils/httpError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: { businessId: string; branchId?: string };
    }
  }
}

// Resolve :branchId do URL, verifica que a filial existe e que o utilizador autenticado
// é membro do negócio dono dessa filial. Bloqueia acesso cruzado entre estabelecimentos
// (regra 4 e 36: isolamento por tenant nunca depende só do frontend).
export function requireBranchAccess() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(errors.unauthorized());

    const branchId = req.params.branchId;
    if (!branchId) return next(errors.badRequest("branchId em falta."));

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, businessId: true },
    });
    if (!branch) return next(errors.notFound("Filial não encontrada."));

    // PLATFORM_ADMIN tem visão global; os restantes papéis exigem membership no negócio.
    if (req.auth.role === "PLATFORM_ADMIN") {
      req.tenant = { businessId: branch.businessId, branchId: branch.id };
      return next();
    }

    const membership = await prisma.businessMember.findUnique({
      where: { userId_businessId: { userId: req.auth.userId, businessId: branch.businessId } },
      select: { id: true },
    });

    if (!membership) {
      return next(errors.forbidden("Não tem acesso a este estabelecimento."));
    }

    req.tenant = { businessId: branch.businessId, branchId: branch.id };
    return next();
  };
}

// Igual, mas resolvendo directamente :businessId (para rotas ao nível do negócio, não da filial).
export function requireBusinessAccess() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(errors.unauthorized());

    const businessId = req.params.businessId;
    if (!businessId) return next(errors.badRequest("businessId em falta."));

    if (req.auth.role === "PLATFORM_ADMIN") {
      req.tenant = { businessId };
      return next();
    }

    const membership = await prisma.businessMember.findUnique({
      where: { userId_businessId: { userId: req.auth.userId, businessId } },
      select: { id: true },
    });

    if (!membership) {
      return next(errors.forbidden("Não tem acesso a este estabelecimento."));
    }

    req.tenant = { businessId };
    return next();
  };
}
