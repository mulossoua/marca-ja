import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("Marcações", () => {
  const app = createApp();
  let managerToken: string;
  let branchId: string;
  let serviceId: string;
  let professionalId: string;
  let customerToken: string;
  const FUTURE_DATE = "2099-01-05"; // segunda-feira

  async function loginAsNewCustomer(email: string) {
    await request(app)
      .post("/auth/register")
      .send({ fullName: "Cliente", email, password: "Password123" });
    const res = await request(app).post("/auth/login").send({ email, password: "Password123" });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    await request(app).post("/auth/register").send({
      fullName: "Gestor Apt",
      email: "gestor.apt.test@example.com",
      password: "Password123",
    });
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "gestor.apt.test@example.com", password: "Password123" });
    managerToken = login.body.accessToken;

    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Barbearia Apt", slug: "barbearia-apt-test", category: "BARBERSHOP" });

    const branch = await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Filial Apt", city: "Nampula", address: "Rua Apt" });
    branchId = branch.body.id;

    await prisma.businessHours.create({
      data: { branchId, weekday: 1, opensAt: "09:00", closesAt: "18:00" },
    });

    const serviceRes = await request(app)
      .post(`/branches/${branchId}/services`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Corte", durationMin: 30, priceCents: 40000 });
    serviceId = serviceRes.body.id;

    const profRes = await request(app)
      .post(`/branches/${branchId}/professionals`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ fullName: "Pedro", specialty: "Barbeiro" });
    professionalId = profRes.body.id;

    await request(app)
      .put(`/branches/${branchId}/services/${serviceId}/professionals`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ professionalIds: [professionalId] });

    await request(app)
      .put(`/branches/${branchId}/professionals/${professionalId}/availability`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ slots: [{ weekday: 1, startTime: "09:00", endTime: "18:00" }] });

    customerToken = await loginAsNewCustomer("cliente.apt.test@example.com");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("cliente cria uma marcação num horário disponível", async () => {
    const res = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T10:00:00` });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING");
  });

  it("rejeita marcação num horário que já está ocupado", async () => {
    const res = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T10:00:00` });

    expect(res.status).toBe(409);
  });

  it("rejeita marcação no passado", async () => {
    const res = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: "2020-01-01T10:00:00" });

    expect(res.status).toBe(400);
  });

  it("CONCORRÊNCIA: de duas marcações simultâneas para o mesmo horário, só uma é aceite", async () => {
    const clientA = await loginAsNewCustomer("concorrencia.a@example.com");
    const clientB = await loginAsNewCustomer("concorrencia.b@example.com");

    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/branches/${branchId}/appointments`)
        .set("Authorization", `Bearer ${clientA}`)
        .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T11:00:00` }),
      request(app)
        .post(`/branches/${branchId}/appointments`)
        .set("Authorization", `Bearer ${clientB}`)
        .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T11:00:00` }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const confirmed = await prisma.appointment.count({
      where: { professionalId, startsAt: new Date(`${FUTURE_DATE}T11:00:00`), status: { not: "CANCELLED" } },
    });
    expect(confirmed).toBe(1);
  });

  it("cliente reagenda a sua marcação para um novo horário livre", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T12:00:00` });

    const res = await request(app)
      .post(`/appointments/${created.body.id}/reschedule`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ startsAt: `${FUTURE_DATE}T13:00:00` });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING");

    const original = await prisma.appointment.findUnique({ where: { id: created.body.id } });
    expect(original?.status).toBe("RESCHEDULED");
  });

  it("cliente cancela a sua marcação", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T14:00:00` });

    const res = await request(app)
      .post(`/appointments/${created.body.id}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Imprevisto" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");
  });

  it("uma marcação CANCELLED não pode ser cancelada outra vez (máquina de estados)", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T15:00:00` });

    await request(app)
      .post(`/appointments/${created.body.id}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({});

    const res = await request(app)
      .post(`/appointments/${created.body.id}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({});

    expect(res.status).toBe(409);
  });

  it("impede um cliente de cancelar a marcação de outro cliente", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T16:00:00` });

    const otherToken = await loginAsNewCustomer("outro.cliente.apt@example.com");
    const res = await request(app)
      .post(`/appointments/${created.body.id}/cancel`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({});

    expect(res.status).toBe(404);
  });

  it("gestor confirma e conclui uma marcação seguindo a máquina de estados", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T17:00:00` });

    const confirm = await request(app)
      .patch(`/branches/${branchId}/appointments/${created.body.id}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "CONFIRMED" });
    expect(confirm.status).toBe(200);

    // Saltar directamente para COMPLETED sem passar por CHECKED_IN/IN_PROGRESS deve falhar.
    const invalidJump = await request(app)
      .patch(`/branches/${branchId}/appointments/${created.body.id}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "COMPLETED" });
    expect(invalidJump.status).toBe(409);

    const checkIn = await request(app)
      .patch(`/branches/${branchId}/appointments/${created.body.id}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "CHECKED_IN" });
    expect(checkIn.status).toBe(200);
  });

  it("lista as marcações do cliente autenticado", async () => {
    const res = await request(app).get("/appointments/mine").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
