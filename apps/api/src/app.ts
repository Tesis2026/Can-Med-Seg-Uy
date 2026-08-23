import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import Fastify from "fastify";

import { registerAuthContext } from "./auth/authContext";
import { authRoutes } from "./auth/authRoutes";
import { mockIdpRoutes } from "./auth/mockIdpRoutes";
import { captchaRoutes } from "./captcha/captchaRoutes";
import { config, isMockIdentityProvider } from "./config";
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
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
  });
  // El IdP mock y el token endpoint hablan application/x-www-form-urlencoded.
  await app.register(formbody);
  registerAuthContext(app);

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

  await app.register(authRoutes, { prefix: "/api" });
  await app.register(captchaRoutes, { prefix: "/api" });
  await app.register(reportRoutes, { prefix: "/api" });

  if (isMockIdentityProvider) {
    await app.register(mockIdpRoutes, { prefix: "/mock-idp" });
    app.log.warn("IdP mock montado en /mock-idp (AUTH_PROVIDER=mock). No usar en producción.");
  }

  app.addHook("onClose", async () => {
    await pool.end();
  });
  return app;
}
