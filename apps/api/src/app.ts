import cors from "@fastify/cors";
import Fastify from "fastify";

import { config } from "./config";
import { pool } from "./database/pool";
import { reportRoutes } from "./reports/reportRoutes";

function getZodIssues(error: unknown): unknown[] | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { name?: string; issues?: unknown; errors?: unknown };
  if (candidate.name !== "ZodError") return null;
  if (Array.isArray(candidate.issues)) return candidate.issues;
  if (Array.isArray(candidate.errors)) return candidate.errors;
  return [];
}

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.CORS_ORIGIN.split(",").map((origin) => origin.trim()) });

  app.get("/health", async (_request, reply) => {
    await pool.query("SELECT 1");
    return reply.send({ status: "ok", database: "ok" });
  });

  app.setErrorHandler((error, request, reply) => {
    const zodIssues = getZodIssues(error);
    if (zodIssues) {
      return reply.code(400).send({
        message: "El reporte contiene datos inválidos o incompletos",
        issues: zodIssues,
      });
    }
    request.log.error({ error }, "Error no controlado en la API");
    return reply.code(500).send({ message: "Error interno del servidor" });
  });

  await app.register(reportRoutes, { prefix: "/api" });

  app.addHook("onClose", async () => {
    await pool.end();
  });
  return app;
}
