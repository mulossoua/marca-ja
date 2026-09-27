import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET deve ter pelo menos 16 caracteres"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET deve ter pelo menos 16 caracteres"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Lista separada por vírgulas de origens autorizadas a chamar a API a partir de
  // um browser (o backoffice). Apps nativas (mobile) não enviam Origin e não são
  // filtradas por CORS — isto protege só contra outros sites no browser.
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuração de ambiente inválida:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
