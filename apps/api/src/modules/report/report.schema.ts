import { z } from "zod";

export const reportRangeSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD."),
  })
  .refine((data) => data.from <= data.to, { message: "'from' deve ser anterior ou igual a 'to'.", path: ["from"] });

export type ReportRangeInput = z.infer<typeof reportRangeSchema>;
