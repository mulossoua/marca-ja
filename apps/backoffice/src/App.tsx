import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "./context/SessionContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import OnboardingBusinessPage from "./pages/OnboardingBusinessPage";
import DashboardPage from "./pages/DashboardPage";
import AgendaPage from "./pages/AgendaPage";
import ServicesPage from "./pages/ServicesPage";
import ProfessionalsPage from "./pages/ProfessionalsPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useSession();
  if (loading) return <div className="content">A carregar...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated, loading, businesses } = useSession();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route
        path="/*"
        element={
          <RequireAuth>
            {!loading && businesses.length === 0 ? (
              <div className="app-shell">
                <OnboardingBusinessPage />
              </div>
            ) : (
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="agenda" element={<AgendaPage />} />
                  <Route path="services" element={<ServicesPage />} />
                  <Route path="professionals" element={<ProfessionalsPage />} />
                </Route>
              </Routes>
            )}
          </RequireAuth>
        }
      />
    </Routes>
  );
}
