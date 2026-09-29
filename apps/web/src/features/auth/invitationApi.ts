import { invitationDetailsSchema, type InvitationDetails } from "@canmedseg/shared";

import { ApiError, apiFetch } from "../../lib/api";

export async function fetchInvitation(invitationId: string): Promise<InvitationDetails> {
  return invitationDetailsSchema.parse(
    await apiFetch(`/api/invitations/${invitationId}`, {
      fallbackMessage: "No se pudo cargar la invitación.",
    }),
  );
}

export async function acceptInvitation(
  invitationId: string,
  input: { displayName: string; password: string; confirmation: string },
): Promise<void> {
  try {
    await apiFetch(`/api/invitations/${invitationId}/accept`, {
      method: "POST",
      body: input,
      fallbackMessage: "No se pudo completar el registro. Intente nuevamente.",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      throw new ApiError("Demasiados intentos seguidos. Espere un minuto y vuelva a intentar.", 429);
    }
    throw error;
  }
}
