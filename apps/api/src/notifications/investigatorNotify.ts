import type { FastifyBaseLogger } from "fastify";

import type { SubmitAdverseEventReport } from "@canmedseg/shared";

/**
 * Aviso interno de nuevo reporte (RF-12.4 stub). El mail real va en Semana 8;
 * acá solo registramos en logs si el evento fue grave.
 */
export function notifyInvestigatorsNewReportStub(
  log: FastifyBaseLogger,
  report: SubmitAdverseEventReport,
  reportId: string,
): void {
  const isSerious = report.events.some((event) => event.isSerious === true);
  log.info(
    {
      reportId,
      isSerious,
      description: report.adverseEventDescription.slice(0, 120),
    },
    isSerious
      ? "Nuevo reporte GRAVE en revisión — notificación a investigadores (stub)"
      : "Nuevo reporte en revisión — notificación a investigadores (stub)",
  );
}
