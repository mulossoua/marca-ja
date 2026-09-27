import { PrismaClient } from "../generated/client";
import bcrypt from "bcryptjs";

// DADOS DE DEMONSTRAÇÃO — nunca usar dados pessoais reais aqui (regra 58).
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Demo@1234", 12);

  const managerA = await prisma.user.create({
    data: {
      email: "gestor.barbearia.demo@example.com",
      passwordHash,
      platformRole: "BUSINESS_MANAGER",
    },
  });

  const barbershop = await prisma.business.create({
    data: {
      name: "Barber Shop Nampula (Demo)",
      slug: "barber-shop-nampula-demo",
      category: "BARBERSHOP",
      description: "Estabelecimento fictício para desenvolvimento.",
      members: { create: { userId: managerA.id } },
    },
  });

  const branchNampula = await prisma.branch.create({
    data: {
      businessId: barbershop.id,
      name: "Filial Central",
      city: "Nampula",
      address: "Av. Eduardo Mondlane, Nampula",
      businessHours: {
        create: Array.from({ length: 6 }, (_, weekday) => ({
          weekday: weekday + 1,
          opensAt: "08:00",
          closesAt: "18:00",
        })),
      },
    },
  });

  const categoryCorte = await prisma.serviceCategory.create({
    data: { branchId: branchNampula.id, name: "Corte" },
  });

  const serviceCorte = await prisma.service.create({
    data: {
      branchId: branchNampula.id,
      categoryId: categoryCorte.id,
      name: "Corte Masculino",
      durationMin: 30,
      priceCents: 45000,
    },
  });

  const serviceCorteBarba = await prisma.service.create({
    data: {
      branchId: branchNampula.id,
      categoryId: categoryCorte.id,
      name: "Corte + Barba",
      durationMin: 60,
      priceCents: 70000,
    },
  });

  const joao = await prisma.professional.create({
    data: {
      branchId: branchNampula.id,
      fullName: "João (Demo)",
      specialty: "Barbeiro",
      services: { create: [{ serviceId: serviceCorte.id }, { serviceId: serviceCorteBarba.id }] },
      availability: {
        create: Array.from({ length: 6 }, (_, weekday) => ({
          weekday: weekday + 1,
          startTime: "08:00",
          endTime: "17:00",
        })),
      },
    },
  });

  // Segundo estabelecimento, para validar isolamento multi-tenant nos testes.
  const managerB = await prisma.user.create({
    data: {
      email: "gestor.salao.demo@example.com",
      passwordHash,
      platformRole: "BUSINESS_MANAGER",
    },
  });

  const salon = await prisma.business.create({
    data: {
      name: "Salão Beleza Maputo (Demo)",
      slug: "salao-beleza-maputo-demo",
      category: "BEAUTY_SALON",
      members: { create: { userId: managerB.id } },
    },
  });

  await prisma.branch.create({
    data: { businessId: salon.id, name: "Filial Baixa", city: "Maputo", address: "Av. Julius Nyerere, Maputo" },
  });

  const customerUser = await prisma.user.create({
    data: {
      email: "cliente.demo@example.com",
      phone: "+258840000000",
      passwordHash,
      platformRole: "CUSTOMER",
      customerProfile: { create: { fullName: "Maria (Demo)" } },
    },
  });

  console.log("Seed de demonstração criado com sucesso:");
  console.log({ managerA: managerA.email, managerB: managerB.email, customerUser: customerUser.email });
  console.log("Password para todas as contas demo: Demo@1234");
  console.log({ barbershop: barbershop.slug, salon: salon.slug, professional: joao.fullName });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
