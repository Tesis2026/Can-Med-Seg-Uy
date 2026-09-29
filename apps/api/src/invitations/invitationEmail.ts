import { config } from "../config";
import { sendEmail } from "../email/mailer";
import { invitationEmail } from "../email/templates";

export const INVITATION_TTL_DAYS = 7;
export const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

/** La invitación quedó guardada pero el email no salió: se puede reenviar desde la lista. */
export class InvitationEmailError extends Error {
  constructor(cause: unknown) {
    super("No se pudo enviar el email de invitación", { cause });
    this.name = "InvitationEmailError";
  }
}

export function invitationUrl(invitationId: string): string {
  return new URL(`/registro/${invitationId}`, config.WEB_BASE_URL).toString();
}

export async function sendInvitationEmail(input: {
  invitationId: string;
  email: string;
  inviterName: string;
}): Promise<void> {
  try {
    await sendEmail(
      invitationEmail({
        to: input.email,
        inviterName: input.inviterName,
        url: invitationUrl(input.invitationId),
        expiresInDays: INVITATION_TTL_DAYS,
      }),
    );
  } catch (error) {
    throw new InvitationEmailError(error);
  }
}
