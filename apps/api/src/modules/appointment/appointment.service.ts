import { Prisma, type AppointmentStatus } from "@app/database";
import { prisma } from "../../lib/prisma";
import { errors } from "../../utils/httpError";
import { BUSY_STATUSES } from "../availability/availability.service";
import { assertTransitionAllowed } from "./appointment.state";
import type { CreateAppointmentInput } from "./appointment.schema";
import {
  notifyAppointmentCancelled,
  notifyAppointmentCreated,
  notifyAppointmentRescheduled,
} from "../notification/notification.service";

// Contexto para notificar o cliente após a transacção da BD já ter sido confirmada
// (a notificação nunca deve poder reverter uma marcação já persistida).
async function buildNotificationContext(appointment: { id: string; customerId: string; branchId: string; serviceId: string; startsAt: Date }) {
  const [customer, branch, service] = await Promise.all([
    prisma.customerProfile.findUnique({ where: { id: appointment.customerId } }),
    prisma.branch.findUnique({ where: { id: appointment.branchId }, include: { business: true } }),
    prisma.service.findUnique({ where: { id: appointment.serviceId } }),
  ]);
  return {
    appointmentId: appointment.id,
    customerUserId: customer?.userId ?? null,
    businessName: branch?.business.name ?? "",
    serviceName: service?.name ?? "",
    startsAt: appointment.startsAt,
  };
}

// Verifica, DENTRO da transacção corrente, se já existe uma marcação activa que
// colida com o intervalo pedido para este profissional (regra 42: nunca confiar
// apenas numa verificação no frontend/antes da transacção).
async function assertSlotStillFree(
  tx: Prisma.TransactionClient,
  professionalId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
) {
  const conflict = await tx.appointment.findFirst({
    where: {
      professionalId,
      status: { in: [...BUSY_STATUSES] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    throw errors.conflict("Este horário acabou de ser reservado. Escolha outro horário.");
  }
}

// Executa uma escrita de agenda com isolamento SERIALIZABLE: se dois clientes
// tentarem reservar o mesmo horário em simultâneo (regra 42), o Postgres detecta
// o conflito de serialização e uma das transacções falha — é apanhada aqui e
// traduzida num 409 claro, nunca deixando as duas marcações coexistirem.
async function runSerializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      throw errors.conflict("Este horário acabou de ser reservado. Escolha outro horário.");
    }
    throw err;
  }
}

export async function createAppointment(
  branchId: string,
  customerId: string,
  input: CreateAppointmentInput,
) {
  if (input.startsAt.getTime() < Date.now()) {
    throw errors.badRequest("Não é possível marcar num horário que já passou.");
  }

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, branchId, isActive: true },
  });
  if (!service) throw errors.notFound("Serviço não encontrado nesta filial.");

  const professional = await prisma.professional.findFirst({
    where: { id: input.professionalId, branchId, isActive: true, services: { some: { serviceId: service.id } } },
  });
  if (!professional) throw errors.badRequest("Profissional não executa este serviço nesta filial.");

  const endsAt = new Date(input.startsAt.getTime() + service.durationMin * 60 * 1000);

  const appointment = await runSerializable(async (tx) => {
    await assertSlotStillFree(tx, professional.id, input.startsAt, endsAt);

    const created = await tx.appointment.create({
      data: {
        branchId,
        customerId,
        professionalId: professional.id,
        serviceId: service.id,
        startsAt: input.startsAt,
        endsAt,
        priceCents: service.priceCents,
        currency: service.currency,
        notes: input.notes,
        status: "PENDING",
      },
    });

    await tx.appointmentStatusHistory.create({
      data: { appointmentId: created.id, fromStatus: null, toStatus: "PENDING" },
    });

    // Toda marcação nasce com um registo de pagamento (regra 27) — nesta versão
    // sempre "pagamento no estabelecimento", nunca um estado ambíguo/em falta.
    await tx.payment.create({
      data: {
        appointmentId: created.id,
        method: "PAY_AT_BUSINESS",
        status: "PENDING",
        amountCents: created.priceCents,
        currency: created.currency,
      },
    });

    return created;
  });

  await notifyAppointmentCreated(await buildNotificationContext(appointment));
  return appointment;
}

async function getOwnedAppointment(appointmentId: string, customerId: string) {
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, customerId } });
  if (!appointment) throw errors.notFound("Marcação não encontrada.");
  return appointment;
}

export async function cancelAppointment(appointmentId: string, customerId: string, reason?: string) {
  const appointment = await getOwnedAppointment(appointmentId, customerId);
  assertTransitionAllowed(appointment.status, "CANCELLED");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
    await tx.appointmentStatusHistory.create({
      data: { appointmentId: appointment.id, fromStatus: appointment.status, toStatus: "CANCELLED" },
    });
    return result;
  });

  await notifyAppointmentCancelled(await buildNotificationContext(updated));
  return updated;
}

// Reagendar NUNCA apenas move a data: cancela (RESCHEDULED) a marcação antiga e cria
// uma nova, passando de novo pelo motor de disponibilidade (regra 18).
export async function rescheduleAppointment(appointmentId: string, customerId: string, newStartsAt: Date) {
  if (newStartsAt.getTime() < Date.now()) {
    throw errors.badRequest("Não é possível reagendar para um horário que já passou.");
  }

  const appointment = await getOwnedAppointment(appointmentId, customerId);
  assertTransitionAllowed(appointment.status, "RESCHEDULED");

  const service = await prisma.service.findUniqueOrThrow({ where: { id: appointment.serviceId } });
  const newEndsAt = new Date(newStartsAt.getTime() + service.durationMin * 60 * 1000);

  const created = await runSerializable(async (tx) => {
    await assertSlotStillFree(tx, appointment.professionalId, newStartsAt, newEndsAt, appointment.id);

    await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: "RESCHEDULED" },
    });
    await tx.appointmentStatusHistory.create({
      data: { appointmentId: appointment.id, fromStatus: appointment.status, toStatus: "RESCHEDULED" },
    });

    const newAppointment = await tx.appointment.create({
      data: {
        branchId: appointment.branchId,
        customerId: appointment.customerId,
        professionalId: appointment.professionalId,
        serviceId: appointment.serviceId,
        startsAt: newStartsAt,
        endsAt: newEndsAt,
        priceCents: appointment.priceCents,
        currency: appointment.currency,
        status: "PENDING",
      },
    });
    await tx.appointmentStatusHistory.create({
      data: { appointmentId: newAppointment.id, fromStatus: null, toStatus: "PENDING" },
    });

    return newAppointment;
  });

  await notifyAppointmentRescheduled(await buildNotificationContext(created));
  return created;
}

export async function listMyAppointments(customerId: string) {
  return prisma.appointment.findMany({
    where: { customerId },
    include: { service: true, professional: true, branch: { include: { business: true } }, payment: true },
    orderBy: { startsAt: "desc" },
  });
}

// Transições operadas pelo profissional/gestor (nunca directamente pelo cliente).
// Quando "professionalId" é passado (rota de auto-serviço), a marcação tem de
// pertencer a esse profissional — nunca a outro colega da mesma filial.
export async function transitionAppointmentByStaff(
  scope: { branchId: string; professionalId?: string },
  appointmentId: string,
  toStatus: Extract<AppointmentStatus, "CONFIRMED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW">,
) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, branchId: scope.branchId, ...(scope.professionalId ? { professionalId: scope.professionalId } : {}) },
  });
  if (!appointment) throw errors.notFound("Marcação não encontrada.");
  assertTransitionAllowed(appointment.status, toStatus);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({ where: { id: appointment.id }, data: { status: toStatus } });
    await tx.appointmentStatusHistory.create({
      data: { appointmentId: appointment.id, fromStatus: appointment.status, toStatus },
    });
    return updated;
  });
}

export async function listBranchAppointments(branchId: string, date?: string) {
  const where: Prisma.AppointmentWhereInput = { branchId };
  if (date) {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    where.startsAt = { gte: dayStart, lt: dayEnd };
  }
  return prisma.appointment.findMany({
    where,
    include: { service: true, professional: true, customer: true, payment: true },
    orderBy: { startsAt: "asc" },
  });
}

// Agenda do próprio profissional (regra 22): nunca aceita um professionalId vindo
// do cliente — quem chama já resolveu o "self" via requireProfessionalSelf.
export async function listProfessionalAppointments(professionalId: string, date?: string) {
  const where: Prisma.AppointmentWhereInput = { professionalId };
  if (date) {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    where.startsAt = { gte: dayStart, lt: dayEnd };
  }
  return prisma.appointment.findMany({
    where,
    include: { service: true, customer: true },
    orderBy: { startsAt: "asc" },
  });
}
