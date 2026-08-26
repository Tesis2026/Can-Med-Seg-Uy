import {
  CONSENT_VERSION,
  acceptConsentInputSchema,
  anonymousSession,
  sessionSchema,
  type Session,
} from "@canmedseg/shared";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import { config, isMockIdentityProvider } from "../config";
import { pool } from "../database/pool";
import type { AuthContext } from "./authContext";
import { clearedSessionCookie, serializeSessionCookie } from "./cookies";
import { requireAuth } from "./guards";
import { consumeLoginState, saveLoginState } from "./loginStateRepository";
import { OidcError, createLoginChallenge, exchangeCodeForIdentity } from "./oidcClient";
import { createSession, revokeSession } from "./sessionRepository";
import { DisabledUserError, acceptConsent, upsertUserFromIdentity } from "./userRepository";

const loginQuerySchema = z.object({
  /** Ruta relativa de la web a la que volver después del login. */
  returnTo: z.string().optional(),
});

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

/** Solo se aceptan destinos internos de la web (evita open redirect). */
function safeReturnTo(value: string | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function webUrl(pathname: string, params: Record<string, string> = {}): string {
  const url = new URL(pathname, config.WEB_BASE_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function toSession(auth: AuthContext): Session {
  if (!auth.user || !auth.expiresAt) return anonymousSession();
  return sessionSchema.parse({
    authenticated: true,
    user: auth.user,
    expiresAt: auth.expiresAt.toISOString(),
    roles: auth.roles,
    permissions: auth.permissions,
  });
}

function clientContext(request: FastifyRequest) {
  return {
    userAgent: request.headers["user-agent"] ?? null,
    ipAddress: request.ip,
  };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  /** Sesión actual; un visitante recibe `authenticated: false` con sus permisos. */
  app.get("/auth/session", async (request, reply) => reply.send(toSession(request.auth)));

  /** Inicio del authorization code flow: redirige al IdP (mock o GUB UY real). */
  app.get("/auth/login", async (request, reply) => {
    const { returnTo } = loginQuerySchema.parse(request.query);
    const challenge = createLoginChallenge();

    await saveLoginState(pool, {
      state: challenge.state,
      nonce: challenge.nonce,
      codeVerifier: challenge.codeVerifier,
      returnTo: safeReturnTo(returnTo),
    });

    return reply.redirect(challenge.authorizationUrl, 302);
  });

  /** Retorno del IdP: valida state, intercambia el code y abre la sesión. */
  app.get("/auth/callback", async (request, reply) => {
    const query = callbackQuerySchema.parse(request.query);

    if (query.error) {
      request.log.warn({ error: query.error, description: query.error_description }, "Login rechazado por el IdP");
      return reply.redirect(webUrl("/login", { error: "idp" }), 302);
    }
    if (!query.code || !query.state) {
      return reply.redirect(webUrl("/login", { error: "respuesta_invalida" }), 302);
    }

    const loginState = await consumeLoginState(pool, query.state);
    if (!loginState) {
      return reply.redirect(webUrl("/login", { error: "estado_expirado" }), 302);
    }

    try {
      const identity = await exchangeCodeForIdentity({
        code: query.code,
        codeVerifier: loginState.codeVerifier,
        nonce: loginState.nonce,
      });

      const user = await upsertUserFromIdentity(pool, identity, {
        provider: config.AUTH_PROVIDER === "mock" ? "mock" : "gubuy",
        seedRoles: isMockIdentityProvider && config.MOCK_IDP_SEED_ROLES,
      });

      const session = await createSession(pool, user.id, clientContext(request));
      reply.header(
        "set-cookie",
        serializeSessionCookie(session.token, {
          maxAgeSeconds: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
          expires: session.expiresAt,
        }),
      );

      // El consentimiento se pide al iniciar un reporte, no al ingresar.
      return reply.redirect(webUrl(loginState.returnTo ?? "/"), 302);
    } catch (error) {
      if (error instanceof DisabledUserError) {
        request.log.warn({ userId: error.userId }, "Login de una cuenta deshabilitada");
        return reply.redirect(webUrl("/login", { error: "cuenta_deshabilitada" }), 302);
      }
      if (error instanceof OidcError) {
        request.log.error({ error, cause: error.cause }, "Falló el intercambio con el IdP");
        return reply.redirect(webUrl("/login", { error: "idp" }), 302);
      }
      request.log.error({ error }, "Error inesperado en el callback de login");
      return reply.redirect(webUrl("/login", { error: "inesperado" }), 302);
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    if (request.auth.token) await revokeSession(pool, request.auth.token);
    reply.header("set-cookie", clearedSessionCookie());
    return reply.send(anonymousSession());
  });

  /** Consentimiento informado (Ley 18.331) aceptado en el primer login. */
  app.post("/auth/consent", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.auth.user;
    if (!user) return reply.code(401).send({ message: "Debe iniciar sesión para continuar." });

    const input = acceptConsentInputSchema.parse(request.body ?? {});
    if (input.version !== CONSENT_VERSION) {
      return reply.code(409).send({
        message: "La versión del consentimiento no es la vigente.",
        expectedVersion: CONSENT_VERSION,
      });
    }

    const updated = await acceptConsent(pool, user.id, input.version);
    if (!updated) return reply.code(404).send({ message: "Usuario no encontrado" });

    return reply.send(
      sessionSchema.parse({
        authenticated: true,
        user: updated,
        expiresAt: (request.auth.expiresAt ?? new Date()).toISOString(),
        roles: updated.roles.map((entry) => entry.role),
        permissions: updated.permissions,
      }),
    );
  });
};
