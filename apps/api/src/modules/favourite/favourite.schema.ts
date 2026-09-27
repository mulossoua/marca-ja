import { z } from "zod";

export const targetTypeSchema = z.enum(["BUSINESS", "BRANCH", "PROFESSIONAL", "SERVICE"]);

export const createFavouriteSchema = z.object({
  targetType: targetTypeSchema,
  targetId: z.string().uuid(),
});

export type CreateFavouriteInput = z.infer<typeof createFavouriteSchema>;
