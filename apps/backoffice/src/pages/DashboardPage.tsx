import React, { useEffect, useState } from "react";
import { useSession } from "../context/SessionContext";
import { formatMoney, listBranchAppointments, todayKey, type AppointmentItem } from "../api/domain";
import { ApiError } from "../api/client";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  RESCHEDULED: "Reagendada",
  CHECKED_IN: "Check-in",
  IN_PROGRESS: "Em curso",
  COMPLETED: "Concluída",
  NO_SHOW: "Falta",
};

export default function DashboardPage() {
  const { currentBranch } = useSession();
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBranch) return;
    setLoading(true);
    listBranchAppointments(currentBranch.id, todayKey())
      .then(setAppointments)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Não foi possível carregar o resumo do dia."))
      .finally(() => setLoading(false));
  }, [currentBranch]);

  const confirmed = appointments.filter((a) => ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(a.status)).length;
  const completed = appointments.filter((a) => a.status === "COMPLETED").length;
  const cancelled = appointments.filter((a) => ["CANCELLED", "NO_SHOW"].includes(a.status)).length;
  const revenue = appointments
    .filter((a) => a.status === "COMPLETED")
    .reduce((sum, a) => sum + a.priceCents, 0);

  return (
    <div className="content">
      <h2>Resumo de hoje</h2>

      <div className="stat-row">
        <div className="card stat-card">
          <div className="stat-value">{appointments.length}</div>
          <div className="stat-label">Marcações hoje</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{confirmed}</div>
          <div className="stat-label">Confirmadas</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{completed}</div>
          <div className="stat-label">Concluídas</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{cancelled}</div>
          <div className="stat-label">Canceladas / faltas</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{formatMoney(revenue, appointments[0]?.currency ?? "MZN")}</div>
          <div className="stat-label">Receita concluída</div>
        </div>
      </div>

      <h2>Próximos atendimentos</h2>
      {error && <p className="error">{error}</p>}
      {!loading && appointments.length === 0 && !error && <p className="muted">Sem marcações para hoje.</p>}

      {appointments.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Cliente</th>
              <th>Serviço</th>
              <th>Profissional</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.startsAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</td>
                <td>{a.customer.fullName}</td>
                <td>{a.service.name}</td>
                <td>{a.professional.fullName}</td>
                <td><span className="badge">{STATUS_LABELS[a.status] ?? a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
