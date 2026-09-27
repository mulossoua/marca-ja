import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

// Este teste garante a regra 4/36: um estabelecimento NUNCA pode consultar
// ou alterar dados de outro estabelecimento, mesmo com um token válido.
describe("Isolamento multi-tenant", () => {
  const app = createApp();
  let businessAToken: string;
  let businessBId: string;
  let branchBId: string;

  beforeAll(async () => {
    await request(app).post("/auth/register").send({
      fullName: "Gestor A",
      email: "gestor.a.test@example.com",
      password: "Password123",
    });

    const loginA = await request(app)
      .post("/auth/login")
      .send({ email: "gestor.a.test@example.com", password: "Password123" });
    businessAToken = loginA.body.accessToken;

    const businessA = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${businessAToken}`)
      .send({ name: "Barbearia A", slug: "barbearia-a-test", category: "BARBERSHOP" });
    expect(businessA.status).toBe(201);

    // Estabelecimento B criado directamente na BD (dono diferente).
    const managerB = await prisma.user.create({
      data: { email: "gestor.b.test@example.com", passwordHash: "x", platformRole: "BUSINESS_MANAGER" },
    });
    const businessB = await prisma.business.create({
      data: {
        name: "Salão B",
        slug: "salao-b-test",
        category: "BEAUTY_SALON",
        members: { create: { userId: managerB.id } },
      },
    });
    businessBId = businessB.id;

    const branchB = await prisma.branch.create({
      data: { businessId: businessB.id, name: "Filial B", city: "Maputo", address: "Rua Teste" },
    });
    branchBId = branchB.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("impede o gestor do estabelecimento A de listar filiais do estabelecimento B", async () => {
    const res = await request(app)
      .get(`/businesses/${businessBId}/branches`)
      .set("Authorization", `Bearer ${businessAToken}`);

    expect(res.status).toBe(403);
  });

  it("impede o gestor do estabelecimento A de criar filial dentro do estabelecimento B", async () => {
    const res = await request(app)
      .post(`/businesses/${businessBId}/branches`)
      .set("Authorization", `Bearer ${businessAToken}`)
      .send({ name: "Filial Invasora", city: "Maputo", address: "Rua Teste" });

    expect(res.status).toBe(403);
  });

  it("rejeita pedidos sem token de autenticação em rotas protegidas", async () => {
    const res = await request(app).get(`/businesses/${branchBId}/branches`);
    expect(res.status).toBe(401);
  });
});
