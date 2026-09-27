// Catálogo de planos (regra 47): a arquitectura de subscrição está pronta para
// SaaS, mas não inventamos preços aqui — nenhum valor monetário é definido até o
// negócio decidir a tabela de preços real. Cada plano só define limites/funcionalidades.
export interface PlanDefinition {
  code: string;
  name: string;
  maxBranches: number;
  maxProfessionalsPerBranch: number;
  features: string[];
}

export const PLAN_CATALOG: Record<string, PlanDefinition> = {
  starter: {
    code: "starter",
    name: "Starter",
    maxBranches: 1,
    maxProfessionalsPerBranch: 3,
    features: ["agendamento", "notificacoes_push"],
  },
  professional: {
    code: "professional",
    name: "Professional",
    maxBranches: 3,
    maxProfessionalsPerBranch: 15,
    features: ["agendamento", "notificacoes_push", "relatorios", "avaliacoes"],
  },
  business: {
    code: "business",
    name: "Business",
    maxBranches: Number.POSITIVE_INFINITY,
    maxProfessionalsPerBranch: Number.POSITIVE_INFINITY,
    features: ["agendamento", "notificacoes_push", "relatorios", "avaliacoes", "multi_filial", "suporte_prioritario"],
  },
};

export function getPlan(planCode: string): PlanDefinition {
  return PLAN_CATALOG[planCode] ?? PLAN_CATALOG.starter;
}

export function listPlans(): PlanDefinition[] {
  return Object.values(PLAN_CATALOG);
}
