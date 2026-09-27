import { z } from "zod";

export const createAppointmentSchema = z.object({
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  startsAt: z.coerce.date(),
  notes: z.string().optional(),
});

export const rescheduleAppointmentSchema = z.object({
  startsAt: z.coerce.date(),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
