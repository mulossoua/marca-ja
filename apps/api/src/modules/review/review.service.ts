import { prisma } from "../../lib/prisma";
import { errors } from "../../utils/httpError";
import type { CreateReviewInput } from "./review.schema";

// Regra 29: só é possível avaliar uma marcação CONCLUÍDA, e só a que é sua.
// O schema já garante um Review por Appointment (appointmentId @unique).
export async function createReview(appointmentId: string, customerId: string, input: CreateReviewInput) {
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, customerId } });
  if (!appointment) throw errors.notFound("Marcação não encontrada.");
  if (appointment.status !== "COMPLETED") {
    throw errors.conflict("Só é possível avaliar marcações já concluídas.");
  }

  const existing = await prisma.review.findUnique({ where: { appointmentId } });
  if (existing) throw errors.conflict("Esta marcação já foi avaliada.");

  return prisma.review.create({
    data: {
      appointmentId,
      customerId,
      professionalId: appointment.professionalId,
      rating: input.rating,
      comment: input.comment,
    },
  });
}

// Avaliações públicas de uma filial (mostradas no perfil do estabelecimento).
export async function listBranchReviews(branchId: string) {
  return prisma.review.findMany({
    where: { appointment: { branchId } },
    include: { customer: { select: { fullName: true } }, professional: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
}
