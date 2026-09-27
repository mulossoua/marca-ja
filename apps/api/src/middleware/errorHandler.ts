import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError";

// Nunca expor mensagens/stack técnicos ao cliente (regra 55 do produto).
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code } });
  }

  // Erros de validação de entrada (zod) são erros do CLIENTE, nunca falhas internas —
  // sem isto, todo pedido inválido devolvia 500 em vez de 400 em toda a API.
  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? "Pedido inválido.";
    return res.status(400).json({ error: { message, code: "VALIDATION_ERROR" } });
  }

  console.error(err);
  return res.status(500).json({
    error: {
      message: "Não conseguimos concluir a operação neste momento. Tente novamente.",
      code: "INTERNAL_ERROR",
    },
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: "Rota não encontrada.", code: "NOT_FOUND" } });
}
