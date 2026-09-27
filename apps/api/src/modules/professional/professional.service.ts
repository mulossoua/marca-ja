import { prisma } from "../../lib/prisma";
import { errors } from "../../utils/httpError";
import { assertCanCreateProfessional } from "../plan/plan.service";
import { recordAudit } from "../audit/audit.service";
import type { CreateProfessionalInput, UpdateProfessionalInput } from "./professional.schema";

export async function createProfessional(branchId: string, input: CreateProfessionalInput) {
  await assertCanCreateProfessional(branchId);
  return prisma.professional.create({ data: { branchId, ...input } });
}

export async function listProfessionals(branchId: string, includeInactive = false) {
  return prisma.professional.findMany({
    where: { branchId, ...(includeInactive ? {} : { isActive: true }) },
    include: { services: { include: { service: true } } },
    orderBy: { createdAt: "asc" },
  });
}

async function getProfessionalInBranch(branchId: string, professionalId: string) {
  const professional = await prisma.professional.findFirst({ where: { id: professionalId, branchId } });
  if (!professional) throw errors.notFound("Profissional não encontrado.");
  return professional;
}

export async function updateProfessional(branchId: string, professionalId: string, input: UpdateProfessionalInput) {
  await getProfessionalInBranch(branchId, professionalId);
  return prisma.professional.update({ where: { id: professionalId }, data: input });
}

export async function deactivateProfessional(branchId: string, professionalId: string) {
  await getProfessionalInBranch(branchId, professionalId);
  return prisma.professional.update({ where: { id: professionalId }, data: { isActive: false } });
}

// Substitui a disponibilidade semanal recorrente por completo (regra 15: motor de
// disponibilidade nunca deve somar sobras de configurações anteriores).
export async function setAvailability(
  branchId: string,
  professionalId: string,
  slots: { weekday: number; startTime: string; endTime: string }[],
  actorUserId?: string,
) {
  await getProfessionalInBranch(branchId, professionalId);

  for (const slot of slots) {
    if (slot.startTime >= slot.endTime) {
      throw errors.badRequest(`Horário inválido no dia ${slot.weekday}: início deve ser antes do fim.`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.professionalAvailability.deleteMany({ where: { professionalId } });
    if (slots.length > 0) {
      await tx.professionalAvailability.createMany({
        data: slots.map((slot) => ({ professionalId, ...slot })),
      });
    }
    return tx.professionalAvailability.findMany({ where: { professionalId } });
  });

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } });
  await recordAudit({
    businessId: branch?.businessId,
    userId: actorUserId,
    action: "PROFESSIONAL_AVAILABILITY_CHANGED",
    entityType: "Professional",
    entityId: professionalId,
    metadata: { slots },
  });

  return result;
}

export async function createTimeBlock(
  branchId: string,
  professionalId: string,
  input: { startsAt: Date; endsAt: Date; reason?: string },
) {
  await getProfessionalInBranch(branchId, professionalId);
  return prisma.timeBlock.create({ data: { professionalId, ...input } });
}

export async function listTimeBlocks(branchId: string, professionalId: string) {
  await getProfessionalInBranch(branchId, professionalId);
  return prisma.timeBlock.findMany({ where: { professionalId }, orderBy: { startsAt: "asc" } });
}

export async function deleteTimeBlock(branchId: string, professionalId: string, timeBlockId: string) {
  await getProfessionalInBranch(branchId, professionalId);
  const block = await prisma.timeBlock.findFirst({ where: { id: timeBlockId, professionalId } });
  if (!block) throw errors.notFound("Bloqueio não encontrado.");
  await prisma.timeBlock.delete({ where: { id: timeBlockId } });
}

// Liga uma conta de utilizador já existente a um perfil de profissional (convite
// feito pelo gestor). Um utilizador só pode estar ligado a um profissional de cada
// vez — nunca substitui um vínculo já existente de outro profissional.
export async function linkUserAccount(branchId: string, professionalId: string, email: string, actorUserId?: string) {
  const professional = await getProfessionalInBranch(branchId, professionalId);
  if (professional.userId) throw errors.conflict("Este profissional já está associado a uma conta.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw errors.notFound("Não existe nenhuma conta com este email.");

  const alreadyLinked = await prisma.professional.findUnique({ where: { userId: user.id } });
  if (alreadyLinked) throw errors.conflict("Esta conta já está associada a outro profissional.");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.professional.update({ where: { id: professionalId }, data: { userId: user.id } });
    if (user.platformRole === "CUSTOMER") {
      await tx.user.update({ where: { id: user.id }, data: { platformRole: "PROFESSIONAL" } });
    }
    return result;
  });

  // Auditoria (regra 48): ligar uma conta a um profissional é uma alteração de
  // permissões — passa a ter acesso à agenda/bloqueios desse perfil.
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } });
  await recordAudit({
    businessId: branch?.businessId,
    userId: actorUserId,
    action: "PROFESSIONAL_ACCOUNT_LINKED",
    entityType: "Professional",
    entityId: professionalId,
    metadata: { linkedEmail: email },
  });

  return updated;
}
