import { z } from "zod";

export const createProfessionalSchema = z.object({
  fullName: z.string().min(2),
  specialty: z.string().optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const updateProfessionalSchema = createProfessionalSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const weekdaySchema = z.number().int().min(0).max(6);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida, use HH:MM.");

export const setAvailabilitySchema = z.object({
  slots: z.array(
    z.object({
      weekday: weekdaySchema,
      startTime: timeSchema,
      endTime: timeSchema,
    }),
  ),
});

export const createTimeBlockSchema = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    reason: z.string().optional(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "endsAt deve ser posterior a startsAt.",
    path: ["endsAt"],
  });

export type CreateProfessionalInput = z.infer<typeof createProfessionalSchema>;
export type UpdateProfessionalInput = z.infer<typeof updateProfessionalSchema>;
