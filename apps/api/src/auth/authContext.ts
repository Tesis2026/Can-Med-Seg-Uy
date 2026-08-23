import {
  Role,
  permissionsForRoles,
  type PermissionValue,
  type RoleValue,
  type SessionUser,
} from "@canmedseg/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { pool } from "../database/pool";
import { readCookie } from "./cookies";
import { config } from "../config";
import { touchSession } from "./sessionRepository";
import { findSessionUser } from "./userRepository";

/** Contexto de autenticación disponible en cada request. */
export type AuthContext = {
  /** Token de la cookie (necesario para revocar la sesión en el logout). */
  token: string | null;
  sessionId: string | null;
  expiresAt: Date | null;
  user: SessionUser | null;
  roles: RoleValue[];
  permissions: PermissionValue[];
};

const ANONYMOUS: AuthContext = {
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

/**
 * Resuelve la sesión desde la cookie httpOnly. Nunca falla la request: una
 * petición sin sesión queda como visitante anónimo (RF-1.2) y son los guards los
 * que deciden si eso alcanza.
 *
 * Se aplica directamente sobre la instancia (sin `register`) para que el hook no
 * quede encapsulado y valga también para los plugins de rutas hermanos.
 */
export function registerAuthContext(app: FastifyInstance): void {
  app.decorateRequest("auth");

  app.addHook("onRequest", async (request: FastifyRequest) => {
    request.auth = ANONYMOUS;

    const token = readCookie(request.headers.cookie, config.SESSION_COOKIE_NAME);
    if (!token) return;

    try {
      const session = await touchSession(pool, token);
      if (!session) return;

      const user = await findSessionUser(pool, session.userId);
      if (!user) return;

      request.auth = {
        token,
        sessionId: session.id,
        expiresAt: session.expiresAt,
        user,
        roles: user.roles.map((entry) => entry.role),
        permissions: user.permissions,
      };
    } catch (error) {
      request.log.error({ error }, "No se pudo resolver la sesión; se continúa como visitante");
    }
  });
}
