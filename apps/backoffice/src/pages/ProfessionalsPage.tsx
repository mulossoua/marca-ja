import React, { useEffect, useState } from "react";
import { useSession } from "../context/SessionContext";
import {
  createProfessional,
  listProfessionals,
  listServices,
  assignProfessionalsToService,
  setProfessionalAvailability,
  type ProfessionalItem,
  type ServiceItem,
} from "../api/domain";
import { ApiError } from "../api/client";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function ProfessionalsPage() {
  const { currentBranch } = useSession();
  const [professionals, setProfessionals] = useState<ProfessionalItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!currentBranch) return;
    const [profs, svcs] = await Promise.all([listProfessionals(currentBranch.id), listServices(currentBranch.id)]);
    setProfessionals(profs);
    setServices(svcs);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar profissionais."));
  }, [currentBranch]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!currentBranch) return;
    setError(null);
    setSaving(true);
    try {
      await createProfessional(currentBranch.id, { fullName, specialty: specialty || undefined });
      setFullName("");
      setSpecialty("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o profissional.");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickSetup(professionalId: string) {
    if (!currentBranch) return;
    // Configuração rápida: segunda a sábado, 08:00–18:00, e todos os serviços activos.
    await setProfessionalAvailability(
      currentBranch.id,
      professionalId,
      [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "08:00", endTime: "18:00" })),
    );
    await Promise.all(
      services
        .filter((s) => s.isActive)
        .map((s) => assignProfessionalsToService(currentBranch.id, s.id, [professionalId])),
    );
    alert("Disponibilidade padrão (Seg-Sáb, 08:00-18:00) e todos os serviços atribuídos.");
  }

  return (
    <div className="content">
      <h2>Profissionais</h2>

      <form className="card" onSubmit={handleCreate}>
        <div className="form-row">
          <div>
            <label>Nome completo</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label>Especialidade</label>
            <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Barbeiro" />
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit" disabled={saving}>
          {saving ? "A guardar..." : "Adicionar profissional"}
        </button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Especialidade</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {professionals.map((p) => (
            <tr key={p.id}>
              <td>{p.fullName}</td>
              <td>{p.specialty ?? "—"}</td>
              <td><span className="badge">{p.isActive ? "Activo" : "Inactivo"}</span></td>
              <td>
                <button className="secondary" onClick={() => handleQuickSetup(p.id)}>
                  Configuração rápida (Seg-Sáb 08-18h)
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 12 }}>
        Dica: "{WEEKDAYS.join(", ")}" mostra a ordem dos dias usada na disponibilidade semanal.
      </p>
    </div>
  );
}
