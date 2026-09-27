import type { NextFunction, Request, Response } from "express";
import type { PlatformRole } from "@app/database";
import { verifyAccessToken } from "../utils/jwt";
import { errors } from "../utils/httpError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; role: PlatformRole };
    }
  }
}

// Extrai e valida o Bearer token. Nunca confiar em headers/params para identidade (regra 36).
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(errors.unauthorized());
  }

  try {
    const token = header.slice("Bearer ".length);
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(errors.unauthorized("Sessão expirada ou inválida."));
  }
}

// Autorização por papel da plataforma. Composto com requireAuth.
export function requireRole(...roles: PlatformRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(errors.unauthorized());
    if (!roles.includes(req.auth.role)) return next(errors.forbidden());
    return next();
  };
}
