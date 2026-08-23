import { hasPermission, type PermissionValue } from "@canmedseg/shared";
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";

/**
 * Guards de la API. El envío de reportes queda deliberadamente sin guard:
 * un visitante anónimo debe poder notificar (RF-1.2 / RF-3).
 */

function unauthorized(reply: FastifyReply): FastifyReply {
  return reply.code(401).send({ message: "Debe iniciar sesión para continuar." });
}

function forbidden(reply: FastifyReply): FastifyReply {
  return reply.code(403).send({ message: "No tiene permisos para esta acción." });
}

export const requireAuth: preHandlerHookHandler = async (request, reply) => {
  if (!request.auth.user) return unauthorized(reply);
};

/** Exige un permiso concreto de la matriz (documentacion/diagramas.md §4.2). */
export function requirePermission(permission: PermissionValue): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth.user) return unauthorized(reply);
    if (!hasPermission(request.auth.permissions, permission)) return forbidden(reply);
  };
}
