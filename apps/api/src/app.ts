import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import Fastify from "fastify";

import { userAdminRoutes } from "./admin/userAdminRoutes";
import { registerAuthContext } from "./auth/authContext";
import { authRoutes } from "./auth/authRoutes";
import { betterAuthRoutes } from "./auth/betterAuthRoutes";
import { mockIdpRoutes } from "./auth/mockIdpRoutes";
import { analyticsRoutes } from "./analytics/analyticsRoutes";
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
        message: request.url.startsWith("/api/admin/")
          ? "Los datos ingresados son inválidos o están incompletos"
          : "El reporte contiene datos inválidos o incompletos",
        issues: zodIssues,
      });
    }
    request.log.error({ error }, "Error no controlado en la API");
    return reply.code(500).send({ message: "Error interno del servidor" });
  });

  await app.register(authRoutes, { prefix: "/api" });
  await app.register(betterAuthRoutes, { prefix: "/api" });
  await app.register(userAdminRoutes, { prefix: "/api" });
  await app.register(captchaRoutes, { prefix: "/api" });
  await app.register(reportRoutes, { prefix: "/api" });
  await app.register(analyticsRoutes, { prefix: "/api" });

  // Registro con GUB UY: deprecado momentáneamente. El IdP mock se sigue montando
  // con AUTH_PROVIDER=mock, pero la web ya no tiene botón que lleve a él.
  if (isMockIdentityProvider) {
    await app.register(mockIdpRoutes, { prefix: "/mock-idp" });
    app.log.warn("IdP mock montado en /mock-idp (AUTH_PROVIDER=mock). No usar en producción.");
  }

  app.addHook("onClose", async () => {
    await pool.end();
  });
  return app;
}
