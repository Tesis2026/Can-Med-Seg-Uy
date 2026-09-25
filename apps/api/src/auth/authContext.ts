import {
  Role,
  permissionsForRoles,
  type PermissionValue,
  type RoleValue,
  type SessionUser,
} from "@canmedseg/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { fromNodeHeaders } from "better-auth/node";

import { pool } from "../database/pool";
import { readCookie } from "./cookies";
import { config } from "../config";
import { auth } from "./betterAuth";
import { touchSession } from "./sessionRepository";
import { findSessionUser } from "./userRepository";

/** Contexto de autenticación disponible en cada request. */
export type AuthContext = {
  /** Origen de la sesión: better-auth (email + contraseña) o la cookie legacy de GUB UY. */
  source: "better-auth" | "gubuy" | null;
  /** Token de la cookie legacy (necesario para revocar esa sesión en el logout). */
  token: string | null;
  sessionId: string | null;
  expiresAt: Date | null;
  user: SessionUser | null;
  roles: RoleValue[];
  permissions: PermissionValue[];
};

const ANONYMOUS: AuthContext = {
  source: null,
  token: null,
  sessionId: null,
  expiresAt: null,
  user: null,
  roles: [Role.Anonimo],
  permissions: permissionsForRoles([Role.Anonimo]),
};

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

function authenticated(
  source: NonNullable<AuthContext["source"]>,
  session: { id: string; expiresAt: Date; token: string | null },
  user: SessionUser,
): AuthContext {
  return {
    source,
    token: session.token,
    sessionId: session.id,
    expiresAt: session.expiresAt,
    user,
    roles: user.roles.map((entry) => entry.role),
    permissions: user.permissions,
  };
}

/** Sesión de better-auth (ingreso con email + contraseña). */
async function resolveBetterAuthSession(request: FastifyRequest): Promise<AuthContext | null> {
  const result = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!result) return null;

  // `findSessionUser` descarta cuentas desactivadas aunque la sesión siga viva.
  const user = await findSessionUser(pool, result.user.id);
  if (!user) return null;

  return authenticated(
    "better-auth",
    { id: result.session.id, expiresAt: new Date(result.session.expiresAt), token: null },
    user,
  );
}

/** Registro con GUB UY: deprecado momentáneamente. Sesión de la cookie legacy del login OIDC. */
async function resolveGubUySession(request: FastifyRequest): Promise<AuthContext | null> {
  const token = readCookie(request.headers.cookie, config.SESSION_COOKIE_NAME);
  if (!token) return null;

  const session = await touchSession(pool, token);
  if (!session) return null;

  const user = await findSessionUser(pool, session.userId);
  if (!user) return null;

  return authenticated("gubuy", { id: session.id, expiresAt: session.expiresAt, token }, user);
}

/**
 * Resuelve la sesión desde las cookies httpOnly. Nunca falla la request: una
 * petición sin sesión queda como visitante anónimo (RF-1.2) y son los guards los
 * que deciden si eso alcanza.
 *
 * Primero se busca la sesión de better-auth y, si no hay, la legacy de GUB UY.
 *
 * Se aplica directamente sobre la instancia (sin `register`) para que el hook no
 * quede encapsulado y valga también para los plugins de rutas hermanos.
 */
export function registerAuthContext(app: FastifyInstance): void {
  app.decorateRequest("auth");

  app.addHook("onRequest", async (request: FastifyRequest) => {
    request.auth = ANONYMOUS;

    try {
      request.auth =
        (await resolveBetterAuthSession(request)) ?? (await resolveGubUySession(request)) ?? ANONYMOUS;
    } catch (error) {
      request.log.error({ error }, "No se pudo resolver la sesión; se continúa como visitante");
    }
  });
}
