import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

// Integração: motor de disponibilidade ligado à BD real, via endpoint público.
describe("Disponibilidade (integração)", () => {
  const app = createApp();
  let branchId: string;
  let serviceId: string;
  let professionalId: string;
  let customerProfileId: string;
  const FUTURE_MONDAY = "2099-01-05";

  beforeAll(async () => {
    await request(app).post("/auth/register").send({
      fullName: "Gestor Disp",
      email: "gestor.disp.test@example.com",
      password: "Password123",
    });
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "gestor.disp.test@example.com", password: "Password123" });
    const token = login.body.accessToken;

    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Barbearia Disp", slug: "barbearia-disp-test", category: "BARBERSHOP" });

    const branch = await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Filial Disp", city: "Nampula", address: "Rua Z" });
    branchId = branch.body.id;

    // Segunda-feira: aberto 09:00–12:00
    await prisma.businessHours.create({
      data: { branchId, weekday: 1, opensAt: "09:00", closesAt: "12:00" },
    });

    const serviceRes = await request(app)
      .post(`/branches/${branchId}/services`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Corte", durationMin: 30, priceCents: 40000 });
    serviceId = serviceRes.body.id;

    const profRes = await request(app)
      .post(`/branches/${branchId}/professionals`)
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: "Ana", specialty: "Cabeleireira" });
    professionalId = profRes.body.id;

    await request(app)
      .put(`/branches/${branchId}/services/${serviceId}/professionals`)
      .set("Authorization", `Bearer ${token}`)
      .send({ professionalIds: [professionalId] });

    await request(app)
      .put(`/branches/${branchId}/professionals/${professionalId}/availability`)
      .set("Authorization", `Bearer ${token}`)
      .send({ slots: [{ weekday: 1, startTime: "09:00", endTime: "12:00" }] });

    const customer = await prisma.user.create({
      data: {
        email: "cliente.disp.test@example.com",
        passwordHash: "x",
        platformRole: "CUSTOMER",
        customerProfile: { create: { fullName: "Cliente Teste" } },
      },
      include: { customerProfile: true },
    });
    customerProfileId = customer.customerProfile!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("devolve horários dentro do intervalo de funcionamento", async () => {
    const res = await request(app).get(
      `/branches/${branchId}/availability?serviceId=${serviceId}&date=${FUTURE_MONDAY}`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].professionalId).toBe(professionalId);
    expect(res.body[0].slots.length).toBeGreaterThan(0);
    expect(res.body[0].slots).toContain(new Date(`${FUTURE_MONDAY}T09:00:00`).toISOString());
  });

  it("remove da disponibilidade um horário já ocupado por uma marcação existente", async () => {
    await prisma.appointment.create({
      data: {
        branchId,
        customerId: customerProfileId,
        professionalId,
        serviceId,
        startsAt: new Date(`${FUTURE_MONDAY}T09:00:00`),
        endsAt: new Date(`${FUTURE_MONDAY}T09:30:00`),
        status: "CONFIRMED",
        priceCents: 40000,
      },
    });

    const res = await request(app).get(
      `/branches/${branchId}/availability?serviceId=${serviceId}&date=${FUTURE_MONDAY}`,
    );

    const slots: string[] = res.body[0].slots;
    expect(slots).not.toContain(new Date(`${FUTURE_MONDAY}T09:00:00`).toISOString());
    expect(slots).toContain(new Date(`${FUTURE_MONDAY}T09:30:00`).toISOString());
  });

  it("uma marcação CANCELLED não bloqueia o horário", async () => {
    await prisma.appointment.updateMany({
      where: { branchId, professionalId },
      data: { status: "CANCELLED" },
    });

    const res = await request(app).get(
      `/branches/${branchId}/availability?serviceId=${serviceId}&date=${FUTURE_MONDAY}`,
    );

    const slots: string[] = res.body[0].slots;
    expect(slots).toContain(new Date(`${FUTURE_MONDAY}T09:00:00`).toISOString());
  });
});
