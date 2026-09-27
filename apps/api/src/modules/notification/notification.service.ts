import type { NotificationChannel, NotificationType } from "@app/database";
import { prisma } from "../../lib/prisma";
import { errors } from "../../utils/httpError";
import { consoleNotificationSender, type NotificationSender } from "./notification.sender";

let activeSender: NotificationSender = consoleNotificationSender;

// Permite trocar o sender em testes ou quando um sender real for integrado,
// sem tocar em nenhum dos chamadores (createAppointment, cancelAppointment, …).
export function setNotificationSender(sender: NotificationSender) {
  activeSender = sender;
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  options: { channel?: NotificationChannel; appointmentId?: string } = {},
) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      channel: options.channel ?? "PUSH",
      title,
      body,
      appointmentId: options.appointmentId,
    },
  });

  // Falha no envio nunca deve reverter a operação de negócio que a originou
  // (ex.: uma marcação não pode falhar só porque a notificação não chegou).
  try {
    await activeSender.send(notification);
    await prisma.notification.update({ where: { id: notification.id }, data: { sentAt: new Date() } });
  } catch (err) {
    console.error("Falha ao enviar notificação", notification.id, err);
  }

  return notification;
}

export async function listMyNotifications(userId: string) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function markAsRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({ where: { id: notificationId, userId } });
  if (!notification) throw errors.notFound("Notificação não encontrada.");
  return prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
}

// --- Eventos de negócio ligados ao ciclo de vida da marcação (regra 20) ---

interface AppointmentNotificationContext {
  appointmentId: string;
  customerUserId: string | null;
  businessName: string;
  serviceName: string;
  startsAt: Date;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function notifyAppointmentCreated(ctx: AppointmentNotificationContext) {
  if (!ctx.customerUserId) return;
  await createNotification(
    ctx.customerUserId,
    "APPOINTMENT_CONFIRMED",
    "Marcação confirmada",
    `A sua marcação de ${ctx.serviceName} em ${ctx.businessName} para ${formatDateTime(ctx.startsAt)} foi registada.`,
    { appointmentId: ctx.appointmentId },
  );
}

export async function notifyAppointmentCancelled(ctx: AppointmentNotificationContext) {
  if (!ctx.customerUserId) return;
  await createNotification(
    ctx.customerUserId,
    "APPOINTMENT_CANCELLED",
    "Marcação cancelada",
    `A sua marcação de ${ctx.serviceName} em ${ctx.businessName} para ${formatDateTime(ctx.startsAt)} foi cancelada.`,
    { appointmentId: ctx.appointmentId },
  );
}

export async function notifyAppointmentRescheduled(ctx: AppointmentNotificationContext) {
  if (!ctx.customerUserId) return;
  await createNotification(
    ctx.customerUserId,
    "APPOINTMENT_RESCHEDULED",
    "Marcação reagendada",
    `A sua marcação de ${ctx.serviceName} em ${ctx.businessName} foi reagendada para ${formatDateTime(ctx.startsAt)}.`,
    { appointmentId: ctx.appointmentId },
  );
}

// Encontra marcações que começam dentro da janela indicada e ainda não receberam
// lembrete — pensado para ser chamado por um agendador externo (cron), regra 20/21.
// Devolve as marcações notificadas, para o chamador poder registar/auditar.
export async function sendUpcomingReminders(withinHours: number) {
  const now = new Date();
  const limit = new Date(now.getTime() + withinHours * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { gte: now, lte: limit },
    },
    include: {
      service: true,
      branch: { include: { business: true } },
      customer: true,
    },
  });

  const notified: string[] = [];
  for (const appointment of appointments) {
    if (!appointment.customer.userId) continue;

    // Evita duplicar lembretes: verifica se já existe um para esta marcação exacta.
    const existing = await prisma.notification.findFirst({
      where: { appointmentId: appointment.id, type: "APPOINTMENT_REMINDER" },
    });
    if (existing) continue;

    await createNotification(
      appointment.customer.userId,
      "APPOINTMENT_REMINDER",
      "Lembrete de marcação",
      `Lembrete: tem uma marcação de ${appointment.service.name} em ${appointment.branch.business.name} em breve.`,
      { appointmentId: appointment.id },
    );
    notified.push(appointment.id);
  }
  return notified;
}
