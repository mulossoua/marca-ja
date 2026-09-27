import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

// Cobre a Fase D: CRUD de serviços/profissionais escopado por filial e isolamento
// entre estabelecimentos (regra 26: nunca aceder a dados de outro estabelecimento).
describe("Serviços e Profissionais", () => {
  const app = createApp();
  let tokenA: string;
  let branchAId: string;
  let branchBId: string;
  let serviceId: string;
  let professionalId: string;

  beforeAll(async () => {
    await request(app).post("/auth/register").send({
      fullName: "Gestor Svc",
      email: "gestor.svc.test@example.com",
      password: "Password123",
    });
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "gestor.svc.test@example.com", password: "Password123" });
    tokenA = login.body.accessToken;

    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Barbearia Svc", slug: "barbearia-svc-test", category: "BARBERSHOP" });

    const branch = await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Filial Svc", city: "Nampula", address: "Rua X" });
    branchAId = branch.body.id;

    // Filial de outro estabelecimento, para os testes de isolamento.
    const managerB = await prisma.user.create({
      data: { email: "gestor.svc.b@example.com", passwordHash: "x", platformRole: "BUSINESS_MANAGER" },
    });
    const businessB = await prisma.business.create({
      data: {
        name: "Salão Svc B",
        slug: "salao-svc-b-test",
        category: "BEAUTY_SALON",
        members: { create: { userId: managerB.id } },
      },
    });
    const branchB = await prisma.branch.create({
      data: { businessId: businessB.id, name: "Filial Svc B", city: "Maputo", address: "Rua Y" },
    });
    branchBId = branchB.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("cria um serviço na própria filial", async () => {
    const res = await request(app)
      .post(`/branches/${branchAId}/services`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Corte Masculino", durationMin: 30, priceCents: 45000 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Corte Masculino");
    serviceId = res.body.id;
  });

  it("lista o serviço publicamente sem autenticação", async () => {
    const res = await request(app).get(`/branches/${branchAId}/services/public`);
    expect(res.status).toBe(200);
    expect(res.body.some((s: { id: string }) => s.id === serviceId)).toBe(true);
  });

  it("cria um profissional e associa-o ao serviço", async () => {
    const profRes = await request(app)
      .post(`/branches/${branchAId}/professionals`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ fullName: "João", specialty: "Barbeiro" });
    expect(profRes.status).toBe(201);
    professionalId = profRes.body.id;

    const assignRes = await request(app)
      .put(`/branches/${branchAId}/services/${serviceId}/professionals`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ professionalIds: [professionalId] });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body).toHaveLength(1);
  });

  it("define disponibilidade semanal do profissional", async () => {
    const res = await request(app)
      .put(`/branches/${branchAId}/professionals/${professionalId}/availability`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ slots: [{ weekday: 1, startTime: "08:00", endTime: "17:00" }] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("rejeita disponibilidade com hora de início depois da hora de fim", async () => {
    const res = await request(app)
      .put(`/branches/${branchAId}/professionals/${professionalId}/availability`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ slots: [{ weekday: 1, startTime: "18:00", endTime: "08:00" }] });

    expect(res.status).toBe(400);
  });

  it("impede o gestor A de criar serviço na filial do estabelecimento B", async () => {
    const res = await request(app)
      .post(`/branches/${branchBId}/services`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Invasão", durationMin: 30, priceCents: 1000 });

    expect(res.status).toBe(403);
  });

  it("impede o gestor A de listar profissionais da filial do estabelecimento B", async () => {
    const res = await request(app)
      .get(`/branches/${branchBId}/professionals`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
  });

  it("rejeita associar profissional de outra filial a um serviço", async () => {
    const foreignProf = await prisma.professional.create({
      data: { branchId: branchBId, fullName: "Estranho" },
    });

    const res = await request(app)
      .put(`/branches/${branchAId}/services/${serviceId}/professionals`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ professionalIds: [foreignProf.id] });

    expect(res.status).toBe(400);
  });
});
