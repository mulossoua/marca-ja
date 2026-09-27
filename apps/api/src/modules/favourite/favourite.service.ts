import { prisma } from "../../lib/prisma";
import { errors } from "../../utils/httpError";
import type { CreateFavouriteInput } from "./favourite.schema";

// Confirma que o alvo existe antes de o guardar como favorito — evita acumular
// favoritos "fantasma" apontando para registos entretanto apagados.
async function assertTargetExists(targetType: CreateFavouriteInput["targetType"], targetId: string) {
  const exists = await (() => {
    switch (targetType) {
      case "BUSINESS":
        return prisma.business.findUnique({ where: { id: targetId }, select: { id: true } });
      case "BRANCH":
        return prisma.branch.findUnique({ where: { id: targetId }, select: { id: true } });
      case "PROFESSIONAL":
        return prisma.professional.findUnique({ where: { id: targetId }, select: { id: true } });
      case "SERVICE":
        return prisma.service.findUnique({ where: { id: targetId }, select: { id: true } });
    }
  })();
  if (!exists) throw errors.notFound("O alvo do favorito não existe.");
}

export async function addFavourite(customerId: string, input: CreateFavouriteInput) {
  await assertTargetExists(input.targetType, input.targetId);

  const existing = await prisma.favourite.findUnique({
    where: { customerId_targetType_targetId: { customerId, targetType: input.targetType, targetId: input.targetId } },
  });
  if (existing) return existing;

  return prisma.favourite.create({ data: { customerId, ...input } });
}

export async function removeFavourite(customerId: string, favouriteId: string) {
  const favourite = await prisma.favourite.findFirst({ where: { id: favouriteId, customerId } });
  if (!favourite) throw errors.notFound("Favorito não encontrado.");
  await prisma.favourite.delete({ where: { id: favouriteId } });
}

export async function listMyFavourites(customerId: string) {
  return prisma.favourite.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } });
}
