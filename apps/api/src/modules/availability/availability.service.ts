import { prisma } from "../../lib/prisma";
import { errors } from "../../utils/httpError";
import { computeAvailableSlots } from "./availability.engine";

// Estados de marcação que efectivamente ocupam a agenda de um profissional
// (regra 15/17): PENDING/CONFIRMED/CHECKED_IN/IN_PROGRESS bloqueiam o horário;
// CANCELLED/RESCHEDULED/NO_SHOW/COMPLETED não devem impedir uma nova marcação
// no mesmo intervalo (COMPLETED já terminou por definição, mas se o horário
// for revisitado no passado nem chega aqui — ver "nunca no passado" no motor).
export const BUSY_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] as const;

export interface AvailabilityQuery {
  branchId: string;
  serviceId: string;
  date: string; // "YYYY-MM-DD"
  professionalId?: string;
}

export interface ProfessionalSlots {
  professionalId: string;
  professionalName: string;
  slots: string[]; // ISO
}

export async function getAvailability(query: AvailabilityQuery): Promise<ProfessionalSlots[]> {
  const date = new Date(`${query.date}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw errors.badRequest("Data inválida, use o formato YYYY-MM-DD.");

  const service = await prisma.service.findFirst({
    where: { id: query.serviceId, branchId: query.branchId, isActive: true },
  });
  if (!service) throw errors.notFound("Serviço não encontrado nesta filial.");

  const weekday = date.getDay();

  const businessHours = await prisma.businessHours.findUnique({
    where: { branchId_weekday: { branchId: query.branchId, weekday } },
  });

  const professionals = await prisma.professional.findMany({
    where: {
      branchId: query.branchId,
      isActive: true,
      ...(query.professionalId ? { id: query.professionalId } : {}),
      services: { some: { serviceId: query.serviceId } },
    },
  });

  if (professionals.length === 0) {
    if (query.professionalId) throw errors.badRequest("Profissional não executa este serviço nesta filial.");
    return [];
  }

  const dayStart = new Date(date);
  const dayEnd = new Date(date);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const results: ProfessionalSlots[] = [];

  for (const professional of professionals) {
    const [weeklyAvailability, timeBlocks, busyAppointments] = await Promise.all([
      prisma.professionalAvailability.findMany({ where: { professionalId: professional.id, weekday } }),
      prisma.timeBlock.findMany({
        where: { professionalId: professional.id, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
      }),
      prisma.appointment.findMany({
        where: {
          professionalId: professional.id,
          status: { in: [...BUSY_STATUSES] },
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
      }),
    ]);

    const slots = computeAvailableSlots({
      date,
      durationMin: service.durationMin,
      businessHours: businessHours
        ? { opensAt: businessHours.opensAt, closesAt: businessHours.closesAt, isClosed: businessHours.isClosed }
        : null,
      weeklyAvailability: weeklyAvailability.map((a) => ({ startTime: a.startTime, endTime: a.endTime })),
      timeBlocks: timeBlocks.map((b) => ({ start: b.startsAt, end: b.endsAt })),
      busyAppointments: busyAppointments.map((a) => ({ start: a.startsAt, end: a.endsAt })),
    });

    if (slots.length > 0) {
      results.push({
        professionalId: professional.id,
        professionalName: professional.fullName,
        slots: slots.map((s) => s.toISOString()),
      });
    }
  }

  return results;
}
