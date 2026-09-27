import type { NextFunction, Request, Response } from "express";
import * as service from "./favourite.service";
import { createFavouriteSchema } from "./favourite.schema";
import { errors } from "../../utils/httpError";
import { prisma } from "../../lib/prisma";

async function requireCustomerProfileId(userId: string): Promise<string> {
  const profile = await prisma.customerProfile.findUnique({ where: { userId } });
  if (!profile) throw errors.forbidden("Apenas clientes têm favoritos.");
  return profile.id;
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    const customerId = await requireCustomerProfileId(req.auth.userId);
    const input = createFavouriteSchema.parse(req.body);
    res.status(201).json(await service.addFavourite(customerId, input));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    const customerId = await requireCustomerProfileId(req.auth.userId);
    await service.removeFavourite(customerId, req.params.favouriteId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    const customerId = await requireCustomerProfileId(req.auth.userId);
    res.json(await service.listMyFavourites(customerId));
  } catch (err) {
    next(err);
  }
}
