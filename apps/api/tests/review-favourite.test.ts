import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("Avaliações e Favoritos", () => {
  const app = createApp();
  let managerToken: string;
  let customerToken: string;
  let branchId: string;
  let businessId: string;
  let serviceId: string;
  let professionalId: string;
  const FUTURE_DATE = "2099-01-05"; // segunda-feira

  async function loginAsNewUser(email: string) {
    await request(app).post("/auth/register").send({ fullName: "Utilizador", email, password: "Password123" });
    const res = await request(app).post("/auth/login").send({ email, password: "Password123" });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    managerToken = await loginAsNewUser("gestor.review.test@example.com");

    const business = await request(app)
      .post("/businesses")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Barbearia Review", slug: "barbearia-review-test", category: "BARBERSHOP" });
    businessId = business.body.id;

    const branch = await request(app)
      .post(`/businesses/${businessId}/branches`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Filial Review", city: "Nampula", address: "Rua Review" });
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
      .send({ fullName: "Profissional Review" });
    professionalId = profRes.body.id;

    await request(app)
      .put(`/branches/${branchId}/services/${serviceId}/professionals`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ professionalIds: [professionalId] });

    await request(app)
      .put(`/branches/${branchId}/professionals/${professionalId}/availability`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ slots: [{ weekday: 1, startTime: "09:00", endTime: "18:00" }] });

    customerToken = await loginAsNewUser("cliente.review.test@example.com");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("impede avaliar uma marcação ainda não concluída", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T10:00:00` });

    const res = await request(app)
      .post(`/appointments/${created.body.id}/review`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 5, comment: "Óptimo atendimento" });

    expect(res.status).toBe(409);
  });

  it("permite avaliar uma marcação concluída e nunca duas vezes", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T11:00:00` });

    for (const status of ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"]) {
      await request(app)
        .patch(`/branches/${branchId}/appointments/${created.body.id}/status`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ status });
    }

    const review = await request(app)
      .post(`/appointments/${created.body.id}/review`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 5, comment: "Óptimo atendimento" });
    expect(review.status).toBe(201);

    const duplicate = await request(app)
      .post(`/appointments/${created.body.id}/review`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 3 });
    expect(duplicate.status).toBe(409);

    const publicList = await request(app).get(`/branches/${branchId}/reviews`);
    expect(publicList.status).toBe(200);
    expect(publicList.body).toHaveLength(1);
    expect(publicList.body[0].rating).toBe(5);
  });

  it("impede avaliar a marcação de outro cliente", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T12:00:00` });

    const otherToken = await loginAsNewUser("outro.review.test@example.com");
    const res = await request(app)
      .post(`/appointments/${created.body.id}/review`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ rating: 4 });

    expect(res.status).toBe(404);
  });

  it("rejeita rating fora do intervalo 1-5", async () => {
    const created = await request(app)
      .post(`/branches/${branchId}/appointments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ serviceId, professionalId, startsAt: `${FUTURE_DATE}T13:00:00` });

    const res = await request(app)
      .post(`/appointments/${created.body.id}/review`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 7 });

    expect(res.status).toBe(400);
  });

  it("adiciona e lista um favorito", async () => {
    const add = await request(app)
      .post("/favourites")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ targetType: "BUSINESS", targetId: businessId });
    expect(add.status).toBe(201);

    const list = await request(app).get("/favourites/mine").set("Authorization", `Bearer ${customerToken}`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].targetId).toBe(businessId);
  });

  it("adicionar o mesmo favorito duas vezes não duplica", async () => {
    await request(app)
      .post("/favourites")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ targetType: "BUSINESS", targetId: businessId });

    const list = await request(app).get("/favourites/mine").set("Authorization", `Bearer ${customerToken}`);
    expect(list.body).toHaveLength(1);
  });

  it("rejeita favoritar um alvo inexistente", async () => {
    const res = await request(app)
      .post("/favourites")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ targetType: "SERVICE", targetId: "00000000-0000-0000-0000-000000000000" });

    expect(res.status).toBe(404);
  });

  it("remove um favorito e impede remover o de outro cliente", async () => {
    const otherToken = await loginAsNewUser("outro.fav.test@example.com");
    const list = await request(app).get("/favourites/mine").set("Authorization", `Bearer ${customerToken}`);
    const favouriteId = list.body[0].id;

    const deniedRemoval = await request(app)
      .delete(`/favourites/${favouriteId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(deniedRemoval.status).toBe(404);

    const removal = await request(app)
      .delete(`/favourites/${favouriteId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(removal.status).toBe(204);
  });
});
