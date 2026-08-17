import {
  reportDetailSchema,
  submitAdverseEventReportSchema,
} from "@canmedseg/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { pool } from "../database/pool";
import { createReport, getReport } from "./reportRepository";

const reportParamsSchema = z.object({ id: z.string().uuid() });

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.post("/reports", async (request, reply) => {
    const report = submitAdverseEventReportSchema.parse(request.body);
    const created = await createReport(pool, report);
    return reply.code(201).send(created);
  });

  app.get("/reports/:id", async (request, reply) => {
    const { id } = reportParamsSchema.parse(request.params);
    const report = await getReport(pool, id);
    if (!report) {
      return reply.code(404).send({ message: "Reporte no encontrado" });
    }
    return reportDetailSchema.parse(report);
  });
};
