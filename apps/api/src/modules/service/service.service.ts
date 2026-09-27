import { prisma } from "../../lib/prisma";
import { errors } from "../../utils/httpError";
import { recordAudit } from "../audit/audit.service";
import type { CreateServiceInput, UpdateServiceInput } from "./service.schema";

export async function createCategory(branchId: string, name: string) {
  const duplicate = await prisma.serviceCategory.findUnique({ where: { branchId_name: { branchId, name } } });
  if (duplicate) throw errors.conflict("Já existe uma categoria com este nome nesta filial.");
  return prisma.serviceCategory.create({ data: { branchId, name } });
}

export async function listCategories(branchId: string) {
  return prisma.serviceCategory.findMany({ where: { branchId } });
}

export async function createService(branchId: string, input: CreateServiceInput) {
  if (input.categoryId) {
    const category = await prisma.serviceCategory.findFirst({ where: { id: input.categoryId, branchId } });
    if (!category) throw errors.badRequest("Categoria não pertence a esta filial.");
  }
  return prisma.service.create({ data: { branchId, ...input } });
}

// Lista pública (para o perfil do estabelecimento no app do cliente) — só serviços activos.
export async function listServices(branchId: string, includeInactive = false) {
  return prisma.service.findMany({
    where: { branchId, ...(includeInactive ? {} : { isActive: true }) },
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });
}

async function getServiceInBranch(branchId: string, serviceId: string) {
  const service = await prisma.service.findFirst({ where: { id: serviceId, branchId } });
  if (!service) throw errors.notFound("Serviço não encontrado.");
  return service;
}

export async function updateService(
  branchId: string,
  serviceId: string,
  input: UpdateServiceInput,
  actorUserId?: string,
) {
  const before = await getServiceInBranch(branchId, serviceId);
  const updated = await prisma.service.update({ where: { id: serviceId }, data: input });

  // Auditoria (regra 48): preço e duração afectam directamente o cliente, vale a
  // pena registar quem mudou o quê e quando.
  if (input.priceCents !== undefined || input.durationMin !== undefined) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } });
    await recordAudit({
      businessId: branch?.businessId,
      userId: actorUserId,
      action: "SERVICE_PRICE_OR_DURATION_UPDATED",
      entityType: "Service",
      entityId: serviceId,
      metadata: {
        before: { priceCents: before.priceCents, durationMin: before.durationMin },
        after: { priceCents: updated.priceCents, durationMin: updated.durationMin },
      },
    });
  }

  return updated;
}

export async function deactivateService(branchId: string, serviceId: string) {
  await getServiceInBranch(branchId, serviceId);
  return prisma.service.update({ where: { id: serviceId }, data: { isActive: false } });
}

// Define o conjunto exacto de profissionais que executam o serviço (substitui associação anterior).
export async function assignProfessionals(branchId: string, serviceId: string, professionalIds: string[]) {
  await getServiceInBranch(branchId, serviceId);

  const validProfessionals = await prisma.professional.findMany({
    where: { id: { in: professionalIds }, branchId },
    select: { id: true },
  });
  if (validProfessionals.length !== professionalIds.length) {
    throw errors.badRequest("Um ou mais profissionais não pertencem a esta filial.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.professionalService.deleteMany({ where: { serviceId } });
    if (professionalIds.length > 0) {
      await tx.professionalService.createMany({
        data: professionalIds.map((professionalId) => ({ professionalId, serviceId })),
      });
    }
    return tx.professionalService.findMany({ where: { serviceId }, include: { professional: true } });
  });
}
