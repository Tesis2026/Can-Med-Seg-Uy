import {
  createdReportSchema,
  type AdverseEventReportDraft,
  type CreatedReport,
} from "@canmedseg/shared";

import { apiUrl } from "../../lib/api";

export async function submitReport(report: AdverseEventReportDraft): Promise<CreatedReport> {
  const response = await fetch(apiUrl("/api/reports"), {
    method: "POST",
    // La sesión viaja en cookie httpOnly: sin esto el reporte de un usuario
    // logueado quedaría guardado como anónimo.
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });

  if (!response.ok) {
    let message = "No se pudo registrar el reporte. Intente nuevamente.";
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      // Un proxy caido puede devolver una respuesta sin JSON.
    }
    throw new Error(message);
  }

  return createdReportSchema.parse(await response.json());
}
