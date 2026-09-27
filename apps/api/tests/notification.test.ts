import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { sendUpcomingReminders } from "../src/modules/notification/notification.service";

describe("Notificações", () => {
  const app = createApp();
  let managerToken: string;
  let customerToken: string;
  let branchId: string;
  let serviceId: string;
  let professionalId: string;
  const FUTURE_DATE = "2099-01-05"; // segunda-feira

  async function loginAsNewUser(email: string) {
    await request(app).post("/auth/register").send({ fullName: "Utilizador", email, password: "Password123" });
    const res = await request(app).post("/auth/login").send({ email, password: "Password123" });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    managerToken = await loginAsNewUser("gestor.notif.test@example.com");

    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Barbearia Notif", slug: "barbearia-notif-test", category: "BARBERSHOP" });

    const branch = await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Filial Notif", city: "Nampula", address: "Rua Notif" });
    branchId = branch.body.id;

    await prisma.businessHours.create({ data: { branchId, weekday: 1, opensAt: "09:00", closesAt: "18:00" } });

    const serviceRes = await request(app)
      .post(`/branches/${branchId}/services`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Corte", durationMin: 30, priceCents: 40000 });
    serviceId = serviceRes.body.id;

    const profRes = await request(app)
      .post(`/branches/${branchId}/professionals`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ fullName: "Profissional Notif" });
    professionalId = profRes.body.id;

    await request(app)
      .put(`/branches/${branchId}/services/${serviceId}/professionals`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ professionalIds: [professionalId] });

    await request(app)
      .put(`/branches/${branchId}/professionals/${professionalId}/availability`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ slots: [{ weekday: 1, startTime: "09:00", endTime: "18:00" }] });

    customerToken = await loginAsNewUser("cliente.notif.test@example.com");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("cria uma notificação de confirmação ao criar a marcação", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T10:00:00` });
    expect(created.status).toBe(201);

    const notifications = await request(app)
      .get("/notifications/mine")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(notifications.status).toBe(200);
    expect(notifications.body.some((n: { type: string }) => n.type === "APPOINTMENT_CONFIRMED")).toBe(true);
  });

  it("cria uma notificação de cancelamento ao cancelar a marcação", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T11:00:00` });

    await request(app)
      .post(`/appointments/${created.body.id}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({});

    const notifications = await request(app)
      .get("/notifications/mine")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(notifications.body.some((n: { type: string }) => n.type === "APPOINTMENT_CANCELLED")).toBe(true);
  });

  it("cria uma notificação de reagendamento ao reagendar", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T12:00:00` });

    await request(app)
      .post(`/appointments/${created.body.id}/reschedule`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ startsAt: `${FUTURE_DATE}T13:00:00` });

    const notifications = await request(app)
      .get("/notifications/mine")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(notifications.body.some((n: { type: string }) => n.type === "APPOINTMENT_RESCHEDULED")).toBe(true);
  });

  it("marca uma notificação própria como lida", async () => {
    const notifications = await request(app)
      .get("/notifications/mine")
      .set("Authorization", `Bearer ${customerToken}`);
    const first = notifications.body[0];
    expect(first.readAt).toBeNull();

    const res = await request(app)
      .patch(`/notifications/${first.id}/read`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.readAt).not.toBeNull();
  });

  it("impede marcar como lida uma notificação de outro utilizador", async () => {
    const otherToken = await loginAsNewUser("outro.notif.test@example.com");
    const notifications = await request(app)
      .get("/notifications/mine")
      .set("Authorization", `Bearer ${customerToken}`);

    const res = await request(app)
      .patch(`/notifications/${notifications.body[0].id}/read`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it("sendUpcomingReminders notifica uma marcação próxima e nunca duplica o lembrete", async () => {
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000); // daqui a 2 horas
    const customer = await prisma.customerProfile.findFirst({
      where: { user: { email: "cliente.notif.test@example.com" } },
    });

    const appointment = await prisma.appointment.create({
      data: {
        branchId,
        customerId: customer!.id,
        professionalId,
        serviceId,
        startsAt: soon,
        endsAt: new Date(soon.getTime() + 30 * 60 * 1000),
        status: "CONFIRMED",
        priceCents: 40000,
      },
    });

    const firstRun = await sendUpcomingReminders(24);
    expect(firstRun).toContain(appointment.id);

    const secondRun = await sendUpcomingReminders(24);
    expect(secondRun).not.toContain(appointment.id);

    const reminderCount = await prisma.notification.count({
      where: { appointmentId: appointment.id, type: "APPOINTMENT_REMINDER" },
    });
    expect(reminderCount).toBe(1);
  });
});
