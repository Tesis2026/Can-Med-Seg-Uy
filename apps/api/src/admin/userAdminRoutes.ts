import {
  Permission,
  Role,
  adminUserListSchema,
  adminUserSchema,
  createUserInputSchema,
  setUserPasswordInputSchema,
} from "@canmedseg/shared";
import { APIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { auth } from "../auth/betterAuth";
import { requirePermission } from "../auth/guards";
import { pool } from "../database/pool";
import {
  assignInitialRoles,
  countOtherActiveAdmins,
  findAdminUser,
  listAdminUsers,
  setUserDisabled,
} from "./userAdminRepository";

const userParamsSchema = z.object({ id: z.string().uuid() });

/** Mensajes en español para los códigos de better-auth que puede ver el administrador. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "Ya existe un usuario con ese email.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe un usuario con ese email.",
  PASSWORD_TOO_SHORT: "La contraseña es demasiado corta.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  USER_NOT_FOUND: "Usuario no encontrado.",
};

/**
 * Las operaciones se delegan en better-auth con los headers del administrador:
 * además del guard de la app, better-auth valida su sesión y el rol espejo.
 */
function betterAuthHeaders(request: FastifyRequest): Headers {
  return fromNodeHeaders(request.headers);
}

function sendError(reply: FastifyReply, request: FastifyRequest, error: unknown): FastifyReply {
  if (error instanceof APIError) {
    const code = typeof error.body?.code === "string" ? error.body.code : "";
    if (error.statusCode === 401) {
      // Un admin que entró con GUB UY (deprecado) no tiene sesión de better-auth.
      return reply.code(401).send({
        message: "Vuelva a iniciar sesión con email y contraseña para administrar usuarios.",
      });
    }
    const status = code.startsWith("USER_ALREADY_EXISTS") ? 409 : error.statusCode;
    return reply.code(status).send({
      message: AUTH_ERROR_MESSAGES[code] ?? "No se pudo completar la operación.",
      reason: code || undefined,
    });
  }
  request.log.error({ error }, "Error en la gestión de usuarios");
  return reply.code(500).send({ message: "Error interno del servidor" });
}

/**
 * Evita que el administrador se quede afuera: no puede actuar sobre sí mismo ni
 * dejar el sistema sin ningún admin activo.
 */
async function guardProtectedTarget(
  request: FastifyRequest,
  reply: FastifyReply,
  targetId: string,
  action: "desactivar" | "borrar",
): Promise<boolean> {
  if (request.auth.user?.id === targetId) {
    await reply.code(400).send({ message: `No puede ${action} su propia cuenta.` });
    return false;
  }

  const target = await findAdminUser(pool, targetId);
  if (!target) {
    await reply.code(404).send({ message: "Usuario no encontrado." });
    return false;
  }

  const isActiveAdmin = target.active && target.roles.some((entry) => entry.role === Role.Admin);
  if (isActiveAdmin && (await countOtherActiveAdmins(pool, targetId)) === 0) {
    await reply.code(409).send({ message: `No puede ${action} al único administrador activo.` });
    return false;
  }
  return true;
}

/** Gestión de usuarios del administrador (RF-11). */
export const userAdminRoutes: FastifyPluginAsync = async (app) => {
  const preHandler = requirePermission(Permission.UsersManage);

  app.get("/admin/users", { preHandler }, async (_request, reply) =>
    reply.send(adminUserListSchema.parse(await listAdminUsers(pool))),
  );

  app.post("/admin/users", { preHandler }, async (request, reply) => {
    const input = createUserInputSchema.parse(request.body ?? {});

    let userId: string;
    try {
      const created = await auth.api.createUser({
        headers: betterAuthHeaders(request),
        body: {
          email: input.email,
          password: input.password,
          name: input.displayName,
          role: input.roles.some((entry) => entry.role === Role.Admin) ? "admin" : "user",
        },
      });
      userId = created.user.id;
    } catch (error) {
      return sendError(reply, request, error);
    }

    try {
      await assignInitialRoles(pool, userId, input.roles, request.auth.user?.id ?? null);
    } catch (error) {
      // Sin roles la cuenta queda a medias: se deshace el alta.
      await auth.api
        .removeUser({ headers: betterAuthHeaders(request), body: { userId } })
        .catch((cleanupError: unknown) =>
          request.log.error({ cleanupError, userId }, "No se pudo deshacer el alta incompleta"),
        );
      return sendError(reply, request, error);
    }

    const user = await findAdminUser(pool, userId);
    return reply.code(201).send(adminUserSchema.parse(user));
  });

  app.post("/admin/users/:id/password", { preHandler }, async (request, reply) => {
    const { id } = userParamsSchema.parse(request.params);
    const { password } = setUserPasswordInputSchema.parse(request.body ?? {});
    try {
      await auth.api.setUserPassword({
        headers: betterAuthHeaders(request),
        body: { userId: id, newPassword: password },
      });
    } catch (error) {
      return sendError(reply, request, error);
    }
    return reply.code(204).send();
  });

  app.post("/admin/users/:id/deactivate", { preHandler }, async (request, reply) => {
    const { id } = userParamsSchema.parse(request.params);
    if (!(await guardProtectedTarget(request, reply, id, "desactivar"))) return reply;

    try {
      // El ban bloquea el login y revoca sus sesiones de better-auth.
      await auth.api.banUser({
        headers: betterAuthHeaders(request),
        body: { userId: id, banReason: "Desactivado por el administrador" },
      });
    } catch (error) {
      return sendError(reply, request, error);
    }
    await setUserDisabled(pool, id, true);
    return reply.send(adminUserSchema.parse(await findAdminUser(pool, id)));
  });

  app.post("/admin/users/:id/activate", { preHandler }, async (request, reply) => {
    const { id } = userParamsSchema.parse(request.params);
    try {
      await auth.api.unbanUser({ headers: betterAuthHeaders(request), body: { userId: id } });
    } catch (error) {
      return sendError(reply, request, error);
    }
    await setUserDisabled(pool, id, false);
    const user = await findAdminUser(pool, id);
    if (!user) return reply.code(404).send({ message: "Usuario no encontrado." });
    return reply.send(adminUserSchema.parse(user));
  });

  /** Borrado físico: la base elimina en cascada sus reportes, borradores, roles y sesiones. */
  app.delete("/admin/users/:id", { preHandler }, async (request, reply) => {
    const { id } = userParamsSchema.parse(request.params);
    if (!(await guardProtectedTarget(request, reply, id, "borrar"))) return reply;

    try {
      await auth.api.removeUser({ headers: betterAuthHeaders(request), body: { userId: id } });
    } catch (error) {
      return sendError(reply, request, error);
    }
    return reply.code(204).send();
  });
};
