import type { AppointmentStatus } from "@app/database";
import { errors } from "../../utils/httpError";

// Máquina de estados da marcação (regra 17): impede transições inválidas.
// Nunca editar directamente o campo "status" fora desta função.
const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "RESCHEDULED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "RESCHEDULED", "NO_SHOW"],
  CHECKED_IN: ["IN_PROGRESS", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  RESCHEDULED: [],
  NO_SHOW: [],
};

export function assertTransitionAllowed(from: AppointmentStatus, to: AppointmentStatus) {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw errors.conflict(`Não é possível mudar uma marcação de ${from} para ${to}.`);
  }
}
