import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

// Cobre a Fase H: vínculo de conta a um profissional e auto-serviço da sua agenda,
// garantindo que um profissional nunca vê nem altera a agenda de outro colega.
describe("Área do profissional (auto-serviço)", () => {
  const app = createApp();
  let managerToken: string;
  let branchId: string;
  let serviceId: string;
  let professionalAId: string;
  let professionalBId: string;
  let professionalAToken: string;
  let professionalBToken: string;
  let customerToken: string;
  const FUTURE_DATE = "2099-01-05"; // segunda-feira

  async function loginAsNewUser(email: string, fullName = "Utilizador") {
    await request(app).post("/auth/register").send({ fullName, email, password: "Password123" });
    const res = await request(app).post("/auth/login").send({ email, password: "Password123" });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    managerToken = await loginAsNewUser("gestor.prof.test@example.com", "Gestor Prof");

    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Barbearia Prof", slug: "barbearia-prof-test", category: "BARBERSHOP" });

    const branch = await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Filial Prof", city: "Nampula", address: "Rua Prof" });
    branchId = branch.body.id;

    await prisma.businessHours.create({ data: { branchId, weekday: 1, opensAt: "09:00", closesAt: "18:00" } });

    const serviceRes = await request(app)
      .post(`/branches/${branchId}/services`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Corte", durationMin: 30, priceCents: 40000 });
    serviceId = serviceRes.body.id;

    const profA = await request(app)
      .post(`/branches/${branchId}/professionals`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ fullName: "Profissional A" });
    professionalAId = profA.body.id;

    const profB = await request(app)
      .post(`/branches/${branchId}/professionals`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ fullName: "Profissional B" });
    professionalBId = profB.body.id;

    await request(app)
      .put(`/branches/${branchId}/services/${serviceId}/professionals`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ professionalIds: [professionalAId, professionalBId] });

    await request(app)
      .put(`/branches/${branchId}/professionals/${professionalAId}/availability`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ slots: [{ weekday: 1, startTime: "09:00", endTime: "18:00" }] });

    // Contas de utilizador criadas PRIMEIRO, depois ligadas ao perfil de profissional
    // (fluxo real: o profissional já existe operacionalmente antes de ter conta).
    professionalAToken = await loginAsNewUser("profissional.a.test@example.com", "Profissional A");
    professionalBToken = await loginAsNewUser("profissional.b.test@example.com", "Profissional B");

    await request(app)
      .patch(`/branches/${branchId}/professionals/${professionalAId}/link-user`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email: "profissional.a.test@example.com" });

    await request(app)
      .patch(`/branches/${branchId}/professionals/${professionalBId}/link-user`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email: "profissional.b.test@example.com" });

    customerToken = await loginAsNewUser("cliente.prof.test@example.com", "Cliente Prof");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejeita ligar a mesma conta a dois profissionais", async () => {
    const res = await request(app)
      .patch(`/branches/${branchId}/professionals/${professionalBId}/link-user`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email: "profissional.a.test@example.com" });

    expect(res.status).toBe(409);
  });

  it("uma conta sem perfil de profissional não pode aceder à agenda própria", async () => {
    const res = await request(app).get("/me/professional/appointments").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("profissional A vê a sua própria agenda vazia inicialmente", async () => {
    const res = await request(app)
      .get("/me/professional/appointments")
      .set("Authorization", `Bearer ${professionalAToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("cliente marca com o profissional A; só o profissional A vê essa marcação na sua agenda", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId: professionalAId, startsAt: `${FUTURE_DATE}T10:00:00` });
    expect(created.status).toBe(201);

    const agendaA = await request(app)
      .get("/me/professional/appointments")
      .set("Authorization", `Bearer ${professionalAToken}`);
    expect(agendaA.body).toHaveLength(1);
    expect(agendaA.body[0].id).toBe(created.body.id);

    const agendaB = await request(app)
      .get("/me/professional/appointments")
      .set("Authorization", `Bearer ${professionalBToken}`);
    expect(agendaB.body).toEqual([]);
  });

  it("profissional B não consegue confirmar uma marcação do profissional A", async () => {
    const appt = await prisma.appointment.findFirst({ where: { professionalId: professionalAId } });

    const res = await request(app)
      .patch(`/me/professional/appointments/${appt!.id}/status`)
      .set("Authorization", `Bearer ${professionalBToken}`)
      .send({ status: "CONFIRMED" });

    expect(res.status).toBe(404);
  });

  it("profissional A confirma e faz check-in da sua própria marcação", async () => {
    const appt = await prisma.appointment.findFirst({ where: { professionalId: professionalAId } });

    const confirm = await request(app)
      .patch(`/me/professional/appointments/${appt!.id}/status`)
      .set("Authorization", `Bearer ${professionalAToken}`)
      .send({ status: "CONFIRMED" });
    expect(confirm.status).toBe(200);

    const checkIn = await request(app)
      .patch(`/me/professional/appointments/${appt!.id}/status`)
      .set("Authorization", `Bearer ${professionalAToken}`)
      .send({ status: "CHECKED_IN" });
    expect(checkIn.status).toBe(200);
  });

  it("profissional A cria um bloqueio próprio (pausa) e profissional B não o vê nem o apaga", async () => {
    const created = await request(app)
      .post("/me/professional/time-blocks")
      .set("Authorization", `Bearer ${professionalAToken}`)
      .send({ startsAt: `${FUTURE_DATE}T12:00:00`, endsAt: `${FUTURE_DATE}T13:00:00`, reason: "Almoço" });
    expect(created.status).toBe(201);

    const listB = await request(app)
      .get("/me/professional/time-blocks")
      .set("Authorization", `Bearer ${professionalBToken}`);
    expect(listB.body).toEqual([]);

    const deleteAttempt = await request(app)
      .delete(`/me/professional/time-blocks/${created.body.id}`)
      .set("Authorization", `Bearer ${professionalBToken}`);
    expect(deleteAttempt.status).toBe(404);
  });
});
