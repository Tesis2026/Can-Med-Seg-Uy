import { Route, Routes, Navigate } from "react-router-dom";

import { useSession } from "./features/auth/SessionContext";
import { AppShell } from "./layouts/AppShell";
import { DetalleReportePage } from "./pages/DetalleReportePage";
import { FormulariosEnProgresoPage } from "./pages/FormulariosEnProgresoPage";
import { HistorialPage } from "./pages/HistorialPage";
import { InicioPage } from "./pages/InicioPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { ReporteExitoPage } from "./pages/ReporteExitoPage";
import { ReporteWizardPage } from "./pages/ReporteWizardPage";

/**
 * La raíz es la landing institucional para quien no inició sesión y la home
 * personal para quien sí: el usuario logueado no vuelve a la pantalla de
 * presentación. El menú solo aparece en el segundo caso.
 */
function RaizPorSesion() {
  const { session } = useSession();
  return session.authenticated ? <InicioPage /> : <LandingPage />;
}

function ShellRaiz() {
  const { session } = useSession();
  return <AppShell showMenu={session.authenticated} />;
}

export function App() {
  return (
    <Routes>
      <Route element={<ShellRaiz />}>
        <Route index element={<RaizPorSesion />} />
      </Route>
      <Route element={<AppShell />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="reporte" element={<ReporteWizardPage />} />
        <Route path="reporte/exito" element={<ReporteExitoPage />} />
        {/* RF-4.5 y RF-6: solo con sesión; cada página redirige al login. */}
        <Route path="formularios-en-progreso" element={<FormulariosEnProgresoPage />} />
        <Route path="historial" element={<HistorialPage />} />
        <Route path="historial/:id" element={<DetalleReportePage />} />
      </Route>
      {/* La home personal se mudó a la raíz; el retorno del login sigue funcionando. */}
      <Route path="inicio" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
