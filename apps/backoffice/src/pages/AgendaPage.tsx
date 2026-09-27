import React, { useEffect, useState } from "react";
import { useSession } from "../context/SessionContext";
import { listBranchAppointments, transitionAppointment, todayKey, type AppointmentItem } from "../api/domain";
import { ApiError } from "../api/client";

// Próxima transição válida sugerida por estado (espelha a máquina de estados do
// backend em appointment.state.ts — o backend continua a ser a autoridade final).
const NEXT_ACTION: Record<string, { label: string; status: string } | undefined> = {
  PENDING: { label: "Confirmar", status: "CONFIRMED" },
  CONFIRMED: { label: "Check-in", status: "CHECKED_IN" },
  CHECKED_IN: { label: "Iniciar atendimento", status: "IN_PROGRESS" },
  IN_PROGRESS: { label: "Concluir", status: "COMPLETED" },
};

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

export default function AgendaPage() {
  const { currentBranch } = useSession();
  const [date, setDate] = useState(todayKey());
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    if (!currentBranch) return;
    setAppointments(await listBranchAppointments(currentBranch.id, date));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar a agenda."));
  }, [currentBranch, date]);

  async function handleTransition(appointmentId: string, status: string) {
    if (!currentBranch) return;
    setBusyId(appointmentId);
    try {
      await transitionAppointment(currentBranch.id, appointmentId, status);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível actualizar a marcação.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleNoShow(appointmentId: string) {
    await handleTransition(appointmentId, "NO_SHOW");
  }

  return (
    <div className="content">
      <h2>Agenda</h2>

      <label>Data</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 200 }} />

      {error && <p className="error">{error}</p>}
      {appointments.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>
          Sem marcações nesta data.
        </p>
      ) : (
        <table style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Cliente</th>
              <th>Serviço</th>
              <th>Profissional</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => {
              const next = NEXT_ACTION[a.status];
              return (
                <tr key={a.id}>
                  <td>{new Date(a.startsAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{a.customer.fullName}</td>
                  <td>{a.service.name}</td>
                  <td>{a.professional.fullName}</td>
                  <td><span className="badge">{STATUS_LABELS[a.status] ?? a.status}</span></td>
                  <td style={{ display: "flex", gap: 8 }}>
                    {next && (
                      <button
                        className="secondary"
                        disabled={busyId === a.id}
                        onClick={() => handleTransition(a.id, next.status)}
                      >
                        {next.label}
                      </button>
                    )}
                    {["CONFIRMED", "CHECKED_IN"].includes(a.status) && (
                      <button className="danger" disabled={busyId === a.id} onClick={() => handleNoShow(a.id)}>
                        Marcar falta
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
