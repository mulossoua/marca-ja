import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";

export default function Layout() {
  const { businesses, currentBranch, setCurrentBranch, logout } = useSession();
  const navigate = useNavigate();
  const allBranches = businesses.flatMap((b) => b.branches.map((br) => ({ ...br, businessName: b.name })));

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Marca Já</h1>

        {allBranches.length > 1 && (
          <select
            value={currentBranch?.id}
            onChange={(e) => {
              const branch = allBranches.find((b) => b.id === e.target.value);
              if (branch) setCurrentBranch(branch);
            }}
            style={{ marginBottom: 16 }}
          >
            {allBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.businessName} · {b.name}
              </option>
            ))}
          </select>
        )}

        <NavLink to="/" end>
          Resumo
        </NavLink>
        <NavLink to="/agenda">Agenda</NavLink>
        <NavLink to="/services">Serviços</NavLink>
        <NavLink to="/professionals">Profissionais</NavLink>

        <div style={{ flex: 1 }} />
        <button onClick={handleLogout}>Sair</button>
      </aside>
      <Outlet />
    </div>
  );
}
