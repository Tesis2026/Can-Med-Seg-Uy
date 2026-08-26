import {
  Permission,
  hasPermission,
  reportDetailSchema,
  saveReportDraftInputSchema,
  submitReportRequestSchema,
} from "@canmedseg/shared";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import { CaptchaError, consumeVerificationToken } from "../captcha/captchaRepository";
import { pool } from "../database/pool";
import { requirePermission } from "../auth/guards";
import {
  DraftNotFoundError,
  createDraft,
  createReport,
  deleteDraft,
  getDraft,
  getNotifierStats,
  getReport,
  getReviewSummary,
  listDrafts,
  listOwnReports,
  updateDraft,
} from "./reportRepository";

const reportParamsSchema = z.object({ id: z.string().uuid() });

/** El usuario de la sesión; las rutas de borrador/historial ya pasaron el guard. */
function sessionUserId(request: FastifyRequest): string {
  const userId = request.auth.user?.id;
  if (!userId) throw new Error("La ruta requiere sesión y el guard no la resolvió");
  return userId;
}

export const reportRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Envío del reporte. SIN guard de sesión a propósito: un visitante anónimo debe
   * poder notificar (RF-1.2 / RF-3), pero solo si resolvió el CAPTCHA (RF-3.6).
   * Si hay sesión, el reporte queda asociado a ella.
   */
  app.post("/reports", async (request, reply) => {
    const { report, draftId, captchaToken } = submitReportRequestSchema.parse(request.body);
    const user = request.auth.user;

    if (!user) {
      // RF-3.6: el CAPTCHA solo se exige a quien no inició sesión.
      if (!captchaToken) {
        return reply.code(400).send({
          message: "Complete la verificación de seguridad antes de enviar el reporte.",
          reason: "captcha_requerido",
        });
      }
      try {
        await consumeVerificationToken(pool, captchaToken);
      } catch (error) {
        if (error instanceof CaptchaError) {
          return reply.code(400).send({ message: error.message, reason: "captcha_invalido" });
        }
        throw error;
      }

      // RF-3.5: sin sesión, el correo es la única vía para enviarle el recibo.
      if (!report.contact.email.trim()) {
        return reply.code(400).send({
          message: "El correo electrónico es obligatorio para reportar sin iniciar sesión.",
          reason: "email_requerido",
        });
      }
    }

    try {
      const created = await createReport(
        pool,
        report,
        user?.id ?? null,
        user ? (draftId ?? null) : null,
      );
      return reply.code(201).send(created);
    } catch (error) {
      if (error instanceof DraftNotFoundError) {
        return reply.code(404).send({ message: "El borrador ya no está disponible." });
      }
      throw error;
    }
  });

  /* ---------------------------------------------------------------- *
   * Borradores (RF-4). Sin sesión no hay guardado parcial (RF-4.4).
   * ---------------------------------------------------------------- */

  app.get(
    "/reports/drafts",
    { preHandler: requirePermission(Permission.ReportDraftWrite) },
    async (request, reply) => reply.send(await listDrafts(pool, sessionUserId(request))),
  );

  app.post(
    "/reports/drafts",
    { preHandler: requirePermission(Permission.ReportDraftWrite) },
    async (request, reply) => {
      const { report } = saveReportDraftInputSchema.parse(request.body);
      return reply.code(201).send(await createDraft(pool, sessionUserId(request), report));
    },
  );

  app.get(
    "/reports/drafts/:id",
    { preHandler: requirePermission(Permission.ReportDraftWrite) },
    async (request, reply) => {
      const { id } = reportParamsSchema.parse(request.params);
      const draft = await getDraft(pool, id, sessionUserId(request));
      if (!draft) return reply.code(404).send({ message: "Borrador no encontrado" });
      return reply.send(draft);
    },
  );

  app.put(
    "/reports/drafts/:id",
    { preHandler: requirePermission(Permission.ReportDraftWrite) },
    async (request, reply) => {
      const { id } = reportParamsSchema.parse(request.params);
      const { report } = saveReportDraftInputSchema.parse(request.body);
      try {
        return reply.send(await updateDraft(pool, id, sessionUserId(request), report));
      } catch (error) {
        if (error instanceof DraftNotFoundError) {
          return reply.code(404).send({ message: "Borrador no encontrado" });
        }
        throw error;
      }
    },
  );

  app.delete(
    "/reports/drafts/:id",
    { preHandler: requirePermission(Permission.ReportDraftWrite) },
    async (request, reply) => {
      const { id } = reportParamsSchema.parse(request.params);
      const deleted = await deleteDraft(pool, id, sessionUserId(request));
      if (!deleted) return reply.code(404).send({ message: "Borrador no encontrado" });
      return reply.code(204).send();
    },
  );

  /* ---------------------------------------------------------------- *
   * Historial propio (RF-6). Un visitante no tiene historial (RF-6.2).
   * ---------------------------------------------------------------- */

  app.get(
    "/reports/history",
    { preHandler: requirePermission(Permission.ReportHistoryRead) },
    async (request, reply) => reply.send(await listOwnReports(pool, sessionUserId(request))),
  );

  /** Contadores de la home del notificador (propios + total nacional). */
  app.get(
    "/reports/stats",
    { preHandler: requirePermission(Permission.ReportHistoryRead) },
    async (request, reply) => reply.send(await getNotifierStats(pool, sessionUserId(request))),
  );

  /** Resumen de la carga de revisión; solo para quien valida reportes (RF-5). */
  app.get(
    "/reports/review-summary",
    { preHandler: requirePermission(Permission.ReportReview) },
    async (_request, reply) => reply.send(await getReviewSummary(pool)),
  );

  /** Detalle de un reporte enviado: su notificador o un revisor (RNF-1.2). */
  app.get("/reports/:id", async (request, reply) => {
    const { id } = reportParamsSchema.parse(request.params);
    const report = await getReport(pool, id, {
      userId: request.auth.user?.id ?? null,
      canReview: hasPermission(request.auth.permissions, Permission.ReportReview),
    });
    if (!report) {
      return reply.code(404).send({ message: "Reporte no encontrado" });
    }
    return reportDetailSchema.parse(report);
  });
};
