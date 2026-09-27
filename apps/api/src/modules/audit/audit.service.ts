import { prisma } from "../../lib/prisma";

// Regra 48: regista operações administrativas sensíveis para permitir investigar
// alterações depois (preços, horários, cancelamentos, permissões). Nunca deve poder
// falhar a operação de negócio que o originou — é sempre "melhor esforço".
export async function recordAudit(params: {
  businessId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        businessId: params.businessId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata as any,
      },
    });
  } catch (err) {
    console.error("Falha ao registar auditoria", params.action, params.entityId, err);
  }
}
