import {
  Permission,
  acceptInvitationInputSchema,
  invitationDetailsSchema,
  inviteResearcherInputSchema,
  pendingInvitationListSchema,
  pendingInvitationSchema,
} from "@canmedseg/shared";
import { APIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { auth } from "../auth/betterAuth";
import { requirePermission } from "../auth/guards";
import { pool } from "../database/pool";
import {
  INVITATION_TTL_MS,
  InvitationEmailError,
  sendInvitationEmail,
} from "./invitationEmail";
import { findOpenInvitation, listOpenInvitations, renewInvitation } from "./invitationRepository";

const invitationParamsSchema = z.object({ id: z.string().uuid() });

const INVALID_INVITATION = {
  message: "La invitación no es válida, ya fue usada o venció. Pida una nueva al administrador.",
  reason: "invitacion_invalida",
};

const ERRORS: Record<string, { status: number; message: string; reason?: string }> = {
  USER_IS_ALREADY_A_MEMBER_OF_THIS_APPLICATION: {
    status: 409,
    message: "Ya existe una cuenta con ese email.",
  },
  USER_WAS_ALREADY_INVITED_TO_THIS_APPLICATION: {
    status: 409,
    message: "Ese email ya tiene una invitación pendiente. Puede reenviarla desde la lista.",
  },
  USER_ALREADY_EXISTS: {
    status: 409,
    message: "Ya existe una cuenta con ese email. Inicie sesión con su contraseña.",
    reason: "cuenta_existente",
  },
  APP_INVITATION_NOT_FOUND: { status: 410, ...INVALID_INVITATION },
  INVITER_IS_NO_LONGER_A_MEMBER_OF_THIS_APPLICATION: { status: 410, ...INVALID_INVITATION },
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_APPLICATION: {
    status: 403,
    message: "Solo el administrador puede invitar investigadores.",
  },
  YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_APP_INVITATION: {
    status: 403,
    message: "Solo el administrador puede cancelar invitaciones.",
  },
  PASSWORD_TOO_SHORT: { status: 400, message: "La contraseña es demasiado corta." },
  PASSWORD_TOO_LONG: { status: 400, message: "La contraseña es demasiado larga." },
  NAME_REQUIRED: { status: 400, message: "Ingrese su nombre." },
};

function sendError(reply: FastifyReply, request: FastifyRequest, error: unknown): FastifyReply {
  if (error instanceof InvitationEmailError) {
    request.log.error({ error: error.cause }, "No se pudo enviar el email de invitación");
    return reply.code(502).send({
      message:
        "La invitación quedó registrada, pero no se pudo enviar el email. Intente reenviarla desde la lista.",
    });
  }
  if (error instanceof APIError) {
    const code = typeof error.body?.code === "string" ? error.body.code : "";
    const known = ERRORS[code];
    if (known) {
      return reply.code(known.status).send({ message: known.message, reason: known.reason ?? code });
    }
    if (error.statusCode === 401) {
      return reply.code(401).send({
        message: "Vuelva a iniciar sesión con email y contraseña para administrar usuarios.",
      });
    }
    request.log.warn({ error }, "Error de better-auth en las invitaciones");
    return reply.code(error.statusCode).send({ message: "No se pudo completar la operación." });
  }
  request.log.error({ error }, "Error en las invitaciones");
  return reply.code(500).send({ message: "Error interno del servidor" });
}

export const invitationRoutes: FastifyPluginAsync = async (app) => {
  const preHandler = requirePermission(Permission.UsersManage);

  app.get("/admin/invitations", { preHandler }, async (_request, reply) =>
    reply.send(pendingInvitationListSchema.parse(await listOpenInvitations(pool))),
  );

  app.post("/admin/invitations", { preHandler }, async (request, reply) => {
    const { email } = inviteResearcherInputSchema.parse(request.body ?? {});
    let invitationId: string;
    try {
      const invitation = await auth.api.createAppInvitation({
        headers: fromNodeHeaders(request.headers),
        body: { type: "personal", email },
      });
      invitationId = invitation.id;
    } catch (error) {
      return sendError(reply, request, error);
    }
    const created = await findOpenInvitation(pool, invitationId);
    return reply.code(201).send(pendingInvitationSchema.parse(created));
  });

  app.post("/admin/invitations/:id/resend", { preHandler }, async (request, reply) => {
    const { id } = invitationParamsSchema.parse(request.params);
    const invitation = await findOpenInvitation(pool, id);
    if (!invitation) {
      return reply.code(404).send({ message: "La invitación ya no está pendiente." });
    }

    await renewInvitation(pool, id, INVITATION_TTL_MS);
    try {
      await sendInvitationEmail({
        invitationId: id,
        email: invitation.email,
        inviterName: request.auth.user?.displayName ?? "",
      });
    } catch (error) {
      return sendError(reply, request, error);
    }
    return reply.send(pendingInvitationSchema.parse(await findOpenInvitation(pool, id)));
  });

  app.delete("/admin/invitations/:id", { preHandler }, async (request, reply) => {
    const { id } = invitationParamsSchema.parse(request.params);
    try {
      await auth.api.cancelAppInvitation({
        headers: fromNodeHeaders(request.headers),
        body: { invitationId: id },
      });
    } catch (error) {
      return sendError(reply, request, error);
    }
    return reply.code(204).send();
  });

  // Públicas: el id de la invitación (uuid aleatorio) es el que habilita el registro.
  app.get("/invitations/:id", async (request, reply) => {
    const { id } = invitationParamsSchema.parse(request.params);
    const invitation = await findOpenInvitation(pool, id);
    if (!invitation || invitation.expired) {
      return reply.code(410).send(INVALID_INVITATION);
    }
    return reply.send(invitationDetailsSchema.parse({ email: invitation.email }));
  });

  app.post("/invitations/:id/accept", async (request, reply) => {
    const { id } = invitationParamsSchema.parse(request.params);
    const input = acceptInvitationInputSchema.parse(request.body ?? {});

    if (request.auth.user) {
      return reply.code(409).send({
        message: "Ya hay una sesión abierta. Ciérrela para aceptar la invitación.",
        reason: "sesion_abierta",
      });
    }

    try {
      // El email sale de la invitación: el plugin ignora cualquier otro.
      const { headers } = await auth.api.acceptAppInvitation({
        headers: fromNodeHeaders(request.headers),
        body: { invitationId: id, name: input.displayName, password: input.password },
        returnHeaders: true,
      });
      const cookies = headers.getSetCookie();
      if (cookies.length > 0) reply.header("set-cookie", cookies);
    } catch (error) {
      return sendError(reply, request, error);
    }
    return reply.code(204).send();
  });
};
