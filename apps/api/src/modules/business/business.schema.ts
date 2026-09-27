import { z } from "zod";

export const createBusinessSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas minúsculas, números e hífen."),
  category: z.enum(["BARBERSHOP", "BEAUTY_SALON"]),
  description: z.string().optional(),
});

export const createBranchSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(3),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
