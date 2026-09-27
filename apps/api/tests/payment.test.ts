import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("Pagamentos", () => {
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
    managerToken = await loginAsNewUser("gestor.pay.test@example.com");

    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Barbearia Pay", slug: "barbearia-pay-test", category: "BARBERSHOP" });

    const branch = await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Filial Pay", city: "Nampula", address: "Rua Pay" });
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
      .send({ fullName: "Profissional Pay" });
    professionalId = profRes.body.id;

    await request(app)
      .put(`/branches/${branchId}/services/${serviceId}/professionals`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ professionalIds: [professionalId] });

    await request(app)
      .put(`/branches/${branchId}/professionals/${professionalId}/availability`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ slots: [{ weekday: 1, startTime: "09:00", endTime: "18:00" }] });

    customerToken = await loginAsNewUser("cliente.pay.test@example.com");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("cria automaticamente um pagamento PENDING ao criar a marcação", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T10:00:00` });
    expect(created.status).toBe(201);

    const payment = await prisma.payment.findUnique({ where: { appointmentId: created.body.id } });
    expect(payment?.status).toBe("PENDING");
    expect(payment?.method).toBe("PAY_AT_BUSINESS");
    expect(payment?.amountCents).toBe(40000);
  });

  it("gestor regista o pagamento como recebido", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T11:00:00` });

    const res = await request(app)
      .patch(`/branches/${branchId}/appointments/${created.body.id}/payment/received`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PAID");
  });

  it("impede registar o mesmo pagamento como recebido duas vezes", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T12:00:00` });

    await request(app)
      .patch(`/branches/${branchId}/appointments/${created.body.id}/payment/received`)
      .set("Authorization", `Bearer ${managerToken}`);

    const secondAttempt = await request(app)
      .patch(`/branches/${branchId}/appointments/${created.body.id}/payment/received`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(secondAttempt.status).toBe(409);
  });

  it("impede um gestor de outro estabelecimento de registar o pagamento", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T13:00:00` });

    const otherManagerToken = await loginAsNewUser("gestor.pay.outro.test@example.com");
    await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${otherManagerToken}`)
      .send({ name: "Salão Outro", slug: "salao-pay-outro-test", category: "BEAUTY_SALON" });

    const res = await request(app)
      .patch(`/branches/${branchId}/appointments/${created.body.id}/payment/received`)
      .set("Authorization", `Bearer ${otherManagerToken}`);

    expect(res.status).toBe(403);
  });

  it("o pagamento aparece nas marcações do cliente e da filial", async () => {
    const mine = await request(app).get("/appointments/mine").set("Authorization", `Bearer ${customerToken}`);
    expect(mine.body[0].payment).toBeTruthy();

    const branchList = await request(app)
      .get(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(branchList.body[0].payment).toBeTruthy();
  });
});
