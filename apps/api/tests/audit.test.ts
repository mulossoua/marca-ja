import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

// Regra 48: operações administrativas sensíveis (preço, horário, permissões, plano)
// devem deixar rasto em AuditLog para poderem ser investigadas depois.
describe("Auditoria", () => {
  const app = createApp();
  let managerToken: string;
  let businessId: string;
  let branchId: string;
  let serviceId: string;
  let professionalId: string;

  async function loginAsNewUser(email: string) {
    await request(app).post("/auth/register").send({ fullName: "Utilizador", email, password: "Password123" });
    const res = await request(app).post("/auth/login").send({ email, password: "Password123" });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    managerToken = await loginAsNewUser("gestor.audit.test@example.com");

    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Barbearia Audit", slug: "barbearia-audit-test", category: "BARBERSHOP" });
    businessId = business.body.id;

    const branch = await request(app)
      .post(`/businesses/${businessId}/branches`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Filial Audit", city: "Nampula", address: "Rua Audit" });
    branchId = branch.body.id;

    const serviceRes = await request(app)
      .post(`/branches/${branchId}/services`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Corte", durationMin: 30, priceCents: 40000 });
    serviceId = serviceRes.body.id;

    const profRes = await request(app)
      .post(`/branches/${branchId}/professionals`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ fullName: "Profissional Audit" });
    professionalId = profRes.body.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("regista uma entrada de auditoria ao alterar o preço de um serviço", async () => {
    await request(app)
      .patch(`/branches/${branchId}/services/${serviceId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ priceCents: 55000 });

    const log = await prisma.auditLog.findFirst({
      where: { entityType: "Service", entityId: serviceId, action: "SERVICE_PRICE_OR_DURATION_UPDATED" },
    });
    expect(log).not.toBeNull();
    expect(log?.businessId).toBe(businessId);
    expect((log?.metadata as any).after.priceCents).toBe(55000);
  });

  it("não regista auditoria quando só o nome do serviço muda (sem impacto no preço/duração)", async () => {
    await request(app)
      .patch(`/branches/${branchId}/services/${serviceId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Corte Renomeado" });

    const count = await prisma.auditLog.count({
      where: { entityType: "Service", entityId: serviceId, action: "SERVICE_PRICE_OR_DURATION_UPDATED" },
    });
    expect(count).toBe(1); // só a alteração de preço do teste anterior
  });

  it("regista auditoria ao mudar a disponibilidade de um profissional", async () => {
    await request(app)
      .put(`/branches/${branchId}/professionals/${professionalId}/availability`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ slots: [{ weekday: 1, startTime: "09:00", endTime: "17:00" }] });

    const log = await prisma.auditLog.findFirst({
      where: { entityType: "Professional", entityId: professionalId, action: "PROFESSIONAL_AVAILABILITY_CHANGED" },
    });
    expect(log).not.toBeNull();
  });

  it("regista auditoria ao ligar uma conta a um profissional", async () => {
    await loginAsNewUser("profissional.audit.test@example.com");
    await request(app)
      .patch(`/branches/${branchId}/professionals/${professionalId}/link-user`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email: "profissional.audit.test@example.com" });

    const log = await prisma.auditLog.findFirst({
      where: { entityType: "Professional", entityId: professionalId, action: "PROFESSIONAL_ACCOUNT_LINKED" },
    });
    expect(log).not.toBeNull();
    expect((log?.metadata as any).linkedEmail).toBe("profissional.audit.test@example.com");
  });

  it("regista auditoria ao mudar o plano do estabelecimento", async () => {
    await prisma.user.update({
      where: { email: "gestor.audit.test@example.com" },
      data: { platformRole: "PLATFORM_ADMIN" },
    });
    const adminLogin = await request(app)
      .post("/auth/login")
      .send({ email: "gestor.audit.test@example.com", password: "Password123" });

    await request(app)
      .patch(`/businesses/${businessId}/plan`)
      .set("Authorization", `Bearer ${adminLogin.body.accessToken}`)
      .send({ planCode: "professional" });

    const log = await prisma.auditLog.findFirst({
      where: { entityType: "Business", entityId: businessId, action: "BUSINESS_PLAN_CHANGED" },
    });
    expect(log).not.toBeNull();
    expect((log?.metadata as any).to).toBe("professional");
  });
});
