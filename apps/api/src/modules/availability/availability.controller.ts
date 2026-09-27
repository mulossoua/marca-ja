import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getAvailability } from "./availability.service";

const querySchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD."),
  professionalId: z.string().uuid().optional(),
});

// Rota pública: o cliente precisa de ver disponibilidade antes de criar conta (regra 7).
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = querySchema.parse(req.query);
    const result = await getAvailability({ branchId: req.params.branchId, ...query });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
