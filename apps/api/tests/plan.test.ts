import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("SaaS e planos", () => {
  const app = createApp();

  async function loginAsNewUser(email: string) {
    await request(app).post("/auth/register").send({ fullName: "Utilizador", email, password: "Password123" });
    const res = await request(app).post("/auth/login").send({ email, password: "Password123" });
    return res.body.accessToken as string;
  }

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lista o catálogo de planos publicamente, sem preços", async () => {
    const res = await request(app).get("/plans");
    expect(res.status).toBe(200);
    expect(res.body.map((p: { code: string }) => p.code)).toEqual(["starter", "professional", "business"]);
    expect(res.body[0]).not.toHaveProperty("priceCents");
    expect(res.body[2].maxBranches).toBeNull(); // plano "business" é ilimitado
  });

  it("um novo estabelecimento nasce no plano starter, limitado a 1 filial", async () => {
    const token = await loginAsNewUser("gestor.plan.test@example.com");
    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Barbearia Plan", slug: "barbearia-plan-test", category: "BARBERSHOP" });
    expect(business.body.planCode).toBe("starter");

    const firstBranch = await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Filial 1", city: "Nampula", address: "Rua 1" });
    expect(firstBranch.status).toBe(201);

    const secondBranch = await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Filial 2", city: "Maputo", address: "Rua 2" });
    expect(secondBranch.status).toBe(409);
  });

  it("depois de mudar para o plano professional, já é possível criar mais filiais", async () => {
    const token = await loginAsNewUser("gestor.plan2.test@example.com");
    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Barbearia Plan 2", slug: "barbearia-plan2-test", category: "BARBERSHOP" });

    await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Filial 1", city: "Nampula", address: "Rua 1" });

    const blocked = await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Filial 2", city: "Maputo", address: "Rua 2" });
    expect(blocked.status).toBe(409);

    const adminUser = await prisma.user.update({
      where: { email: "gestor.plan2.test@example.com" },
      data: { platformRole: "PLATFORM_ADMIN" },
    });
    const adminLogin = await request(app)
      .post("/auth/login")
      .send({ email: "gestor.plan2.test@example.com", password: "Password123" });

    const upgrade = await request(app)
      .patch(`/businesses/${business.body.id}/plan`)
      .set("Authorization", `Bearer ${adminLogin.body.accessToken}`)
      .send({ planCode: "professional" });
    expect(upgrade.status).toBe(200);
    expect(upgrade.body.planCode).toBe("professional");
    expect(adminUser.email).toBe("gestor.plan2.test@example.com");

    const nowAllowed = await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Filial 2", city: "Maputo", address: "Rua 2" });
    expect(nowAllowed.status).toBe(201);
  });

  it("impede um gestor comum (não PLATFORM_ADMIN) de mudar o plano", async () => {
    const token = await loginAsNewUser("gestor.plan3.test@example.com");
    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Barbearia Plan 3", slug: "barbearia-plan3-test", category: "BARBERSHOP" });

    const res = await request(app)
      .patch(`/businesses/${business.body.id}/plan`)
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "business" });

    expect(res.status).toBe(403);
  });

  it("limita o número de profissionais por filial de acordo com o plano", async () => {
    const token = await loginAsNewUser("gestor.plan4.test@example.com");
    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Barbearia Plan 4", slug: "barbearia-plan4-test", category: "BARBERSHOP" });
    const branch = await request(app)
      .post(`/businesses/${business.body.id}/branches`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Filial", city: "Nampula", address: "Rua" });

    // Plano starter permite até 3 profissionais por filial.
    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post(`/branches/${branch.body.id}/professionals`)
        .set("Authorization", `Bearer ${token}`)
        .send({ fullName: `Profissional ${i}` });
      expect(res.status).toBe(201);
    }

    const blocked = await request(app)
      .post(`/branches/${branch.body.id}/professionals`)
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: "Profissional 4" });
    expect(blocked.status).toBe(409);
  });
});
