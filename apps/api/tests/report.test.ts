import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("Relatórios", () => {
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
    managerToken = await loginAsNewUser("gestor.report.test@example.com");

    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Barbearia Report", slug: "barbearia-report-test", category: "BARBERSHOP" });

    const branch = await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Filial Report", city: "Nampula", address: "Rua Report" });
    branchId = branch.body.id;

    await prisma.businessHours.create({ data: { branchId, weekday: 1, opensAt: "09:00", closesAt: "18:00" } });

    const serviceRes = await request(app)
      .post(`/branches/${branchId}/services`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Corte", durationMin: 30, priceCents: 50000 });
    serviceId = serviceRes.body.id;

    const profRes = await request(app)
      .post(`/branches/${branchId}/professionals`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ fullName: "Profissional Report" });
    professionalId = profRes.body.id;

    await request(app)
      .put(`/branches/${branchId}/services/${serviceId}/professionals`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ professionalIds: [professionalId] });

    await request(app)
      .put(`/branches/${branchId}/professionals/${professionalId}/availability`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ slots: [{ weekday: 1, startTime: "09:00", endTime: "18:00" }] });

    customerToken = await loginAsNewUser("cliente.report.test@example.com");

    // Marcação 1: concluída (conta para receita)
    const a1 = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T10:00:00` });
    for (const status of ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"]) {
      await request(app)
        .patch(`/branches/${branchId}/appointments/${a1.body.id}/status`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ status });
    }

    // Marcação 2: cancelada
    const a2 = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T11:00:00` });
    await request(app)
      .post(`/appointments/${a2.body.id}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({});

    // Marcação 3: ainda pendente (não entra em receita nem em cancelamento)
    await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T12:00:00` });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("agrega correctamente marcações, receita e cancelamentos no período", async () => {
    const res = await request(app)
      .get(`/branches/${branchId}/reports?from=2099-01-01&to=2099-01-31`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalAppointments).toBe(3);
    expect(res.body.byStatus.COMPLETED).toBe(1);
    expect(res.body.byStatus.CANCELLED).toBe(1);
    expect(res.body.byStatus.PENDING).toBe(1);
    expect(res.body.revenueCents).toBe(50000);
    expect(res.body.cancellationRate).toBeCloseTo(1 / 3, 4);
    expect(res.body.topServices[0].name).toBe("Corte");
    expect(res.body.topServices[0].count).toBe(3);
    expect(res.body.topProfessionals[0].name).toBe("Profissional Report");
  });

  it("devolve zeros quando não há marcações no período pedido", async () => {
    const res = await request(app)
      .get(`/branches/${branchId}/reports?from=2000-01-01&to=2000-01-31`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalAppointments).toBe(0);
    expect(res.body.revenueCents).toBe(0);
    expect(res.body.cancellationRate).toBe(0);
  });

  it("rejeita um período com 'from' depois de 'to'", async () => {
    const res = await request(app)
      .get(`/branches/${branchId}/reports?from=2099-02-01&to=2099-01-01`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
  });

  it("impede um gestor de outro estabelecimento de ver o relatório desta filial", async () => {
    const otherToken = await loginAsNewUser("gestor.report.outro.test@example.com");
    const res = await request(app)
      .get(`/branches/${branchId}/reports?from=2099-01-01&to=2099-01-31`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});
