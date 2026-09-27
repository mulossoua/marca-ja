import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z.string().min(2, "Nome demasiado curto."),
    email: z.string().email("Email inválido.").optional(),
    phone: z.string().min(9, "Telefone inválido.").optional(),
    password: z.string().min(8, "A palavra-passe deve ter pelo menos 8 caracteres."),
  })
  .refine((data) => data.email || data.phone, {
    message: "Indique email ou telefone.",
    path: ["email"],
  });

export const loginSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    password: z.string().min(1, "Palavra-passe é obrigatória."),
  })
  .refine((data) => data.email || data.phone, {
    message: "Indique email ou telefone.",
    path: ["email"],
  });

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
