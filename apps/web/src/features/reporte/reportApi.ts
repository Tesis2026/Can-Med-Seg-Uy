import {
  createdReportSchema,
  type AdverseEventReportDraft,
  type CreatedReport,
} from "@canmedseg/shared";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function submitReport(report: AdverseEventReportDraft): Promise<CreatedReport> {
  const response = await fetch(`${API_BASE_URL}/api/reports`, {
    method: "POST",
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
