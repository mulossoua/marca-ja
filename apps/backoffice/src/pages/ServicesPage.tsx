import React, { useEffect, useState } from "react";
import { useSession } from "../context/SessionContext";
import { createService, deactivateService, formatMoney, listServices, type ServiceItem } from "../api/domain";
import { ApiError } from "../api/client";

export default function ServicesPage() {
  const { currentBranch } = useSession();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!currentBranch) return;
    setServices(await listServices(currentBranch.id));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar serviços."));
  }, [currentBranch]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!currentBranch) return;
    setError(null);
    setSaving(true);
    try {
      await createService(currentBranch.id, {
        name,
        durationMin: Number(duration),
        priceCents: Math.round(Number(price) * 100),
      });
      setName("");
      setDuration("30");
      setPrice("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o serviço.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(serviceId: string) {
    if (!currentBranch) return;
    await deactivateService(currentBranch.id, serviceId);
    await load();
  }

  return (
    <div className="content">
      <h2>Serviços</h2>

      <form className="card" onSubmit={handleCreate}>
        <div className="form-row">
          <div>
            <label>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label>Duração (min)</label>
            <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} required />
          </div>
          <div>
            <label>Preço (MZN)</label>
            <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit" disabled={saving}>
          {saving ? "A guardar..." : "Adicionar serviço"}
        </button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Duração</th>
            <th>Preço</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.durationMin} min</td>
              <td>{formatMoney(s.priceCents, s.currency)}</td>
              <td><span className="badge">{s.isActive ? "Activo" : "Inactivo"}</span></td>
              <td>
                {s.isActive && (
                  <button className="danger" onClick={() => handleDeactivate(s.id)}>
                    Desactivar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
