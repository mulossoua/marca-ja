import { z } from "zod";

export const createServiceCategorySchema = z.object({
  name: z.string().min(2),
});

export const createServiceSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  durationMin: z.number().int().positive("Duração deve ser maior que zero."),
  priceCents: z.number().int().nonnegative("Preço não pode ser negativo."),
  currency: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export const updateServiceSchema = createServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const assignProfessionalsSchema = z.object({
  professionalIds: z.array(z.string().uuid()),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
