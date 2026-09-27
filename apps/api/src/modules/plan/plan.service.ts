import { prisma } from "../../lib/prisma";
import { errors } from "../../utils/httpError";
import { recordAudit } from "../audit/audit.service";
import { getPlan, listPlans as listCatalog } from "./plan.catalog";

export function listPlans() {
  return listCatalog().map(serializePlan);
}

function serializePlan(plan: ReturnType<typeof getPlan>) {
  return {
    ...plan,
    maxBranches: Number.isFinite(plan.maxBranches) ? plan.maxBranches : null,
    maxProfessionalsPerBranch: Number.isFinite(plan.maxProfessionalsPerBranch) ? plan.maxProfessionalsPerBranch : null,
  };
}

export async function changeBusinessPlan(businessId: string, planCode: string, actorUserId?: string) {
  if (!(planCode in { starter: 1, professional: 1, business: 1 })) {
    throw errors.badRequest("Plano desconhecido.");
  }
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw errors.notFound("Estabelecimento não encontrado.");

  const updated = await prisma.business.update({ where: { id: businessId }, data: { planCode } });

  await recordAudit({
    businessId,
    userId: actorUserId,
    action: "BUSINESS_PLAN_CHANGED",
    entityType: "Business",
    entityId: businessId,
    metadata: { from: business.planCode, to: planCode },
  });

  return updated;
}

// Chamado antes de criar uma filial (regra 47): o plano do negócio limita quantas
// filiais pode ter. Nunca confiar apenas na UI para impor este limite.
export async function assertCanCreateBranch(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw errors.notFound("Estabelecimento não encontrado.");

  const plan = getPlan(business.planCode);
  const branchCount = await prisma.branch.count({ where: { businessId, isActive: true } });

  if (branchCount >= plan.maxBranches) {
    throw errors.conflict(
      `O plano "${plan.name}" permite até ${plan.maxBranches} filial(is). Actualize o plano para criar mais.`,
    );
  }
}

// Chamado antes de criar um profissional: o plano limita profissionais por filial.
export async function assertCanCreateProfessional(branchId: string) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, include: { business: true } });
  if (!branch) throw errors.notFound("Filial não encontrada.");

  const plan = getPlan(branch.business.planCode);
  const professionalCount = await prisma.professional.count({ where: { branchId, isActive: true } });

  if (professionalCount >= plan.maxProfessionalsPerBranch) {
    throw errors.conflict(
      `O plano "${plan.name}" permite até ${plan.maxProfessionalsPerBranch} profissionais por filial. Actualize o plano para adicionar mais.`,
    );
  }
}
