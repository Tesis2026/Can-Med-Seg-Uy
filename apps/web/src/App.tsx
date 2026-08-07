import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./layouts/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { ReporteExitoPage } from "./pages/ReporteExitoPage";
import { ReporteWizardPage } from "./pages/ReporteWizardPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell showMenu={false} />}>
        <Route index element={<LandingPage />} />
      </Route>
      <Route element={<AppShell showMenu />}>
        <Route path="reporte" element={<ReporteWizardPage />} />
        <Route path="reporte/exito" element={<ReporteExitoPage />} />
      </Route>
      <Route path="consentimiento" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
