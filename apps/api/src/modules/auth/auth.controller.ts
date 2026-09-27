import type { NextFunction, Request, Response } from "express";
import { loginSchema, refreshSchema, registerSchema } from "./auth.schema";
import * as authService from "./auth.service";
import { prisma } from "../../lib/prisma";
import { errors } from "../../utils/httpError";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.registerCustomer(input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refreshSession(refreshToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { customerProfile: true },
    });
    if (!user) throw errors.notFound("Utilizador não encontrado.");
    res.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.platformRole,
      customerProfile: user.customerProfile,
    });
  } catch (err) {
    next(err);
  }
}
