import {
  adminUserListSchema,
  adminUserSchema,
  pendingInvitationListSchema,
  pendingInvitationSchema,
  type AdminUser,
  type InviteResearcherInput,
  type PendingInvitation,
} from "@canmedseg/shared";

import { apiFetch } from "../../lib/api";

export async function listUsers(): Promise<AdminUser[]> {
  return adminUserListSchema.parse(
    await apiFetch("/api/admin/users", { fallbackMessage: "No se pudo cargar el listado de usuarios." }),
  );
}

export async function listInvitations(): Promise<PendingInvitation[]> {
  return pendingInvitationListSchema.parse(
    await apiFetch("/api/admin/invitations", {
      fallbackMessage: "No se pudo cargar el listado de invitaciones.",
    }),
  );
}

export async function inviteResearcher(input: InviteResearcherInput): Promise<PendingInvitation> {
  return pendingInvitationSchema.parse(
    await apiFetch("/api/admin/invitations", {
      method: "POST",
      body: input,
      fallbackMessage: "No se pudo enviar la invitación.",
    }),
  );
}

export async function resendInvitation(invitationId: string): Promise<PendingInvitation> {
  return pendingInvitationSchema.parse(
    await apiFetch(`/api/admin/invitations/${invitationId}/resend`, {
      method: "POST",
      fallbackMessage: "No se pudo reenviar la invitación.",
    }),
  );
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  await apiFetch(`/api/admin/invitations/${invitationId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo cancelar la invitación.",
  });
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  await apiFetch(`/api/admin/users/${userId}/password`, {
    method: "POST",
    body: { password },
    fallbackMessage: "No se pudo cambiar la contraseña.",
  });
}

export async function setUserActive(userId: string, active: boolean): Promise<AdminUser> {
  return adminUserSchema.parse(
    await apiFetch(`/api/admin/users/${userId}/${active ? "activate" : "deactivate"}`, {
      method: "POST",
      fallbackMessage: active ? "No se pudo activar el usuario." : "No se pudo desactivar el usuario.",
    }),
  );
}

export async function deleteUser(userId: string): Promise<void> {
  await apiFetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo borrar el usuario.",
  });
}
