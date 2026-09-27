import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { sha256 } from "../../utils/hash";
import { errors } from "../../utils/httpError";
import { env } from "../../config/env";
import type { LoginInput, RegisterInput } from "./auth.schema";

async function issueTokenPair(userId: string, role: string) {
  const accessToken = signAccessToken({ sub: userId, role: role as any });
  const refreshToken = signRefreshToken(userId);

  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: sha256(refreshToken), expiresAt },
  });

  return { accessToken, refreshToken };
}

export async function registerCustomer(input: RegisterInput) {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [input.email ? { email: input.email } : undefined, input.phone ? { phone: input.phone } : undefined].filter(
        Boolean,
      ) as any,
    },
  });
  if (existing) throw errors.conflict("Já existe uma conta com estes dados.");

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      passwordHash,
      platformRole: "CUSTOMER",
      customerProfile: { create: { fullName: input.fullName } },
    },
    include: { customerProfile: true },
  });

  const tokens = await issueTokenPair(user.id, user.platformRole);
  return { user: sanitizeUser(user), ...tokens };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findFirst({
    where: input.email ? { email: input.email } : { phone: input.phone },
    include: { customerProfile: true },
  });

  if (!user || !user.isActive) throw errors.unauthorized("Credenciais inválidas.");

  const validPassword = await verifyPassword(input.password, user.passwordHash);
  if (!validPassword) throw errors.unauthorized("Credenciais inválidas.");

  const tokens = await issueTokenPair(user.id, user.platformRole);
  return { user: sanitizeUser(user), ...tokens };
}

export async function refreshSession(refreshToken: string) {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw errors.unauthorized("Sessão expirada, entre novamente.");
  }

  const tokenHash = sha256(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw errors.unauthorized("Sessão expirada, entre novamente.");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw errors.unauthorized();

  // Rotação: revoga o token usado e emite um novo par (mitiga replay de refresh tokens).
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  const tokens = await issueTokenPair(user.id, user.platformRole);
  return tokens;
}

export async function logout(refreshToken: string) {
  const tokenHash = sha256(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function sanitizeUser(user: { id: string; email: string | null; phone: string | null; platformRole: string }) {
  return { id: user.id, email: user.email, phone: user.phone, role: user.platformRole };
}
