import { prisma } from "../../lib/prisma";
import type { ReportRangeInput } from "./report.schema";

function toRange(input: ReportRangeInput) {
  const from = new Date(`${input.from}T00:00:00`);
  const to = new Date(`${input.to}T00:00:00`);
  to.setDate(to.getDate() + 1); // "to" é inclusivo do dia inteiro
  return { from, to };
}

// Relatório agregado por período (regra 46): marcações, receita, serviços e
// profissionais mais marcados, cancelamentos e faltas. Consultas só de leitura,
// nunca alteram estado — seguro para o gestor correr quantas vezes quiser.
export async function getBranchReport(branchId: string, input: ReportRangeInput) {
  const { from, to } = toRange(input);
  const where = { branchId, startsAt: { gte: from, lt: to } };

  const [total, byStatus, revenueAgg, byService, byProfessional] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.appointment.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { priceCents: true } }),
    prisma.appointment.groupBy({
      by: ["serviceId"],
      where,
      _count: { _all: true },
      orderBy: { _count: { serviceId: "desc" } },
      take: 5,
    }),
    prisma.appointment.groupBy({
      by: ["professionalId"],
      where,
      _count: { _all: true },
      orderBy: { _count: { professionalId: "desc" } },
      take: 5,
    }),
  ]);

  const [services, professionals] = await Promise.all([
    prisma.service.findMany({ where: { id: { in: byService.map((s) => s.serviceId) } }, select: { id: true, name: true } }),
    prisma.professional.findMany({
      where: { id: { in: byProfessional.map((p) => p.professionalId) } },
      select: { id: true, fullName: true },
    }),
  ]);

  const statusCounts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
  const cancelled = statusCounts.CANCELLED ?? 0;
  const noShow = statusCounts.NO_SHOW ?? 0;

  return {
    range: { from: input.from, to: input.to },
    totalAppointments: total,
    byStatus: statusCounts,
    revenueCents: revenueAgg._sum.priceCents ?? 0,
    cancellationRate: total > 0 ? Number((cancelled / total).toFixed(4)) : 0,
    noShowRate: total > 0 ? Number((noShow / total).toFixed(4)) : 0,
    topServices: byService.map((s) => ({
      serviceId: s.serviceId,
      name: services.find((svc) => svc.id === s.serviceId)?.name ?? "—",
      count: s._count._all,
    })),
    topProfessionals: byProfessional.map((p) => ({
      professionalId: p.professionalId,
      name: professionals.find((pr) => pr.id === p.professionalId)?.fullName ?? "—",
      count: p._count._all,
    })),
  };
}
