import crypto from "node:crypto";

// Usado para guardar refresh tokens na BD sem expor o token em claro (regra 36 - gestão segura de sessões).
export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
