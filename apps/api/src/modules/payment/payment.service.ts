import { prisma } from "../../lib/prisma";
import { errors } from "../../utils/httpError";

// Camada de pagamentos desacoplada do resto da aplicação (regra 27). A única
// forma implementada nesta versão é "pagamento no estabelecimento" — nenhum
// gateway online é integrado sem credenciais reais. Trocar/adicionar um método
// de pagamento online no futuro só deve exigir mudanças aqui, nunca no motor de
// marcação ou disponibilidade.

// O gestor confirma que recebeu o pagamento presencialmente (regra 27: primeira
// versão é sempre "pagamento no estabelecimento").
export async function markPaymentReceived(branchId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, branchId },
    include: { payment: true },
  });
  if (!appointment) throw errors.notFound("Marcação não encontrada nesta filial.");
  if (!appointment.payment) throw errors.notFound("Esta marcação não tem pagamento associado.");
  if (appointment.payment.status === "PAID") throw errors.conflict("Este pagamento já foi registado.");
  if (appointment.payment.status === "REFUNDED") throw errors.conflict("Este pagamento já foi reembolsado.");

  return prisma.payment.update({
    where: { appointmentId },
    data: { status: "PAID" },
  });
}

export async function getPaymentForAppointment(appointmentId: string) {
  const payment = await prisma.payment.findUnique({ where: { appointmentId } });
  if (!payment) throw errors.notFound("Pagamento não encontrado.");
  return payment;
}
