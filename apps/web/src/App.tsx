import { Route, Routes, Navigate } from "react-router-dom";

import { ConsentGate } from "./features/auth/ConsentGate";
import { AppShell } from "./layouts/AppShell";
import { ConsentimientoPage } from "./pages/ConsentimientoPage";
import { DetalleReportePage } from "./pages/DetalleReportePage";
import { FormulariosEnProgresoPage } from "./pages/FormulariosEnProgresoPage";
import { HistorialPage } from "./pages/HistorialPage";
import { InicioPage } from "./pages/InicioPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { ReporteExitoPage } from "./pages/ReporteExitoPage";
import { ReporteWizardPage } from "./pages/ReporteWizardPage";

export function App() {
  return (
    <>
      <Routes>
        <Route element={<AppShell showMenu={false} />}>
          <Route index element={<LandingPage />} />
        </Route>
        <Route element={<AppShell title="Iniciar sesión" />}>
          <Route path="login" element={<LoginPage />} />
        </Route>
        <Route element={<AppShell title="Consentimiento" />}>
          <Route path="consentimiento" element={<ConsentimientoPage />} />
        </Route>
        <Route element={<AppShell showMenu />}>
          <Route path="inicio" element={<InicioPage />} />
          <Route path="reporte" element={<ReporteWizardPage />} />
          <Route path="reporte/exito" element={<ReporteExitoPage />} />
          {/* RF-4.5 y RF-6: solo con sesión; cada página redirige al login. */}
          <Route path="formularios-en-progreso" element={<FormulariosEnProgresoPage />} />
          <Route path="historial" element={<HistorialPage />} />
          <Route path="historial/:id" element={<DetalleReportePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* Consentimiento del primer login: bloquea la app hasta aceptarlo. */}
      <ConsentGate />
    </>
  );
}
