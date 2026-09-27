import React, { useState } from "react";
import { useSession } from "../context/SessionContext";
import { createBranch, createBusiness } from "../api/domain";
import { ApiError } from "../api/client";

// Mostrado quando o gestor autenticado ainda não tem nenhum estabelecimento —
// cria o Business e a primeira Branch num único fluxo (regra 63: critério de aceitação).
export default function OnboardingBusinessPage() {
  const { reloadBusinesses } = useSession();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("BARBERSHOP");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const business = await createBusiness({ name, slug, category });
      await createBranch(business.id, { name: "Filial Principal", city, address });
      await reloadBusinesses();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o estabelecimento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="content">
      <h2>Criar o seu estabelecimento</h2>
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
        <label>Nome do estabelecimento</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />

        <label>Identificador (slug, único)</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          placeholder="barbearia-central"
          required
        />

        <label>Categoria</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="BARBERSHOP">Barbearia</option>
          <option value="BEAUTY_SALON">Salão de Beleza</option>
        </select>

        <div className="form-row">
          <div>
            <label>Cidade</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div>
            <label>Endereço</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <button className="primary" type="submit" disabled={loading}>
          {loading ? "A criar..." : "Criar estabelecimento"}
        </button>
      </form>
    </div>
  );
}
