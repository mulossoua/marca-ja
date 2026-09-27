// Tem de ser importado antes de "@app/database": o cliente Prisma gerado carrega
// automaticamente um .env perto do schema.prisma (packages/database/.env) na primeira
// vez que é importado, e o dotenv nunca sobrepõe uma variável já definida. Sem esta
// importação primeiro, DATABASE_URL ficaria preso ao valor de desenvolvimento mesmo
// quando apps/api/.env aponta para outra base de dados (ex.: testes).
import "../config/env";
import { PrismaClient } from "@app/database";

// Instância única de PrismaClient reutilizada em toda a aplicação
// (evita esgotar o pool de ligações em dev com hot-reload).
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
