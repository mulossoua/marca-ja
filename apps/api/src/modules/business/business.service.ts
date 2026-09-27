import { prisma } from "../../lib/prisma";
import { errors } from "../../utils/httpError";
import { assertCanCreateBranch } from "../plan/plan.service";
import type { CreateBranchInput, CreateBusinessInput } from "./business.schema";

// Cria o negócio e torna o utilizador criador o primeiro BUSINESS_MANAGER (regra 4: tenants nunca partilham dados).
export async function createBusiness(ownerUserId: string, input: CreateBusinessInput) {
  const existingSlug = await prisma.business.findUnique({ where: { slug: input.slug } });
  if (existingSlug) throw errors.conflict("Já existe um estabelecimento com este identificador.");

  return prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: input.name,
        slug: input.slug,
        category: input.category,
        description: input.description,
      },
    });

    await tx.businessMember.create({
      data: { businessId: business.id, userId: ownerUserId },
    });

    await tx.user.update({ where: { id: ownerUserId }, data: { platformRole: "BUSINESS_MANAGER" } });

    return business;
  });
}

export async function listMyBusinesses(userId: string) {
  return prisma.business.findMany({
    where: { members: { some: { userId } } },
    include: { branches: true },
  });
}

export async function createBranch(businessId: string, input: CreateBranchInput) {
  const duplicate = await prisma.branch.findUnique({
    where: { businessId_name: { businessId, name: input.name } },
  });
  if (duplicate) throw errors.conflict("Já existe uma filial com este nome neste estabelecimento.");

  await assertCanCreateBranch(businessId);

  return prisma.branch.create({
    data: { businessId, ...input },
  });
}

export async function listBranches(businessId: string) {
  return prisma.branch.findMany({ where: { businessId, isActive: true } });
}

// Pesquisa pública de filiais (usada pelo cliente na Home/Explorar) — nunca expõe dados
// de gestão interna, apenas o necessário para descoberta.
export async function searchBranches(params: { city?: string; category?: string; query?: string }) {
  return prisma.branch.findMany({
    where: {
      isActive: true,
      business: { isActive: true, ...(params.category ? { category: params.category as any } : {}) },
      ...(params.city ? { city: { equals: params.city, mode: "insensitive" } } : {}),
      ...(params.query
        ? {
            OR: [
              { name: { contains: params.query, mode: "insensitive" } },
              { business: { name: { contains: params.query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      city: true,
      address: true,
      business: { select: { id: true, name: true, category: true, logoUrl: true, coverUrl: true } },
    },
    take: 50,
  });
}
