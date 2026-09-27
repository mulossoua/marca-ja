import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env";
import type { PlatformRole } from "@app/database";

export interface AccessTokenPayload {
  sub: string; // userId
  role: PlatformRole;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(userId: string): string {
  // jti garante unicidade mesmo quando dois tokens são emitidos no mesmo segundo
  // (sem isto, o hash guardado em RefreshToken.tokenHash colide e a criação falha).
  const options: jwt.SignOptions = { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` as jwt.SignOptions["expiresIn"] };
  return jwt.sign({ sub: userId, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, options);
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
}
