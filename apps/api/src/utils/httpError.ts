export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const errors = {
  unauthorized: (msg = "Não autenticado.") => new HttpError(401, msg, "UNAUTHORIZED"),
  forbidden: (msg = "Sem permissão para esta acção.") => new HttpError(403, msg, "FORBIDDEN"),
  notFound: (msg = "Recurso não encontrado.") => new HttpError(404, msg, "NOT_FOUND"),
  conflict: (msg = "Conflito ao processar o pedido.") => new HttpError(409, msg, "CONFLICT"),
  badRequest: (msg = "Pedido inválido.") => new HttpError(400, msg, "BAD_REQUEST"),
};
