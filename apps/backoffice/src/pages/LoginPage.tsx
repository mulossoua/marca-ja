import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { ApiError } from "../api/client";

export default function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-box card" onSubmit={handleSubmit}>
        <h2>Backoffice</h2>
        <p className="muted">Entre com a conta de gestor do estabelecimento.</p>

        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />

        <label>Palavra-passe</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />

        {error && <p className="error">{error}</p>}

        <button className="primary" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "A entrar..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
