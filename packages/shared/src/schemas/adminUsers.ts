import { z } from "zod";

import { userRoleSchema } from "./auth";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(PASSWORD_MAX_LENGTH, `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres`);

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  email: z.string().nullable(),
  roles: z.array(userRoleSchema),
  active: z.boolean(),
  /**
   * `local`: creada por el administrador (email + contraseña).
   * `gubuy`/`mock`: registro con GUB UY, deprecado momentáneamente.
   */
  identityProvider: z.string(),
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
});

export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserListSchema = z.array(adminUserSchema);

const emailSchema = z.string().trim().toLowerCase().email("Ingrese un email válido");

/** Toda cuenta invitada queda con el rol Investigador: el admin solo indica el email. */
export const inviteResearcherInputSchema = z.object({
  email: emailSchema,
});

export type InviteResearcherInput = z.infer<typeof inviteResearcherInputSchema>;

export const pendingInvitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  inviterName: z.string().nullable(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  /** Vencida: ya no se puede usar, pero se puede reenviar (renueva el plazo). */
  expired: z.boolean(),
});

export type PendingInvitation = z.infer<typeof pendingInvitationSchema>;

export const pendingInvitationListSchema = z.array(pendingInvitationSchema);

/** Lo único que ve la persona invitada antes de registrarse. */
export const invitationDetailsSchema = z.object({
  email: z.string(),
});

export type InvitationDetails = z.infer<typeof invitationDetailsSchema>;

export const acceptInvitationInputSchema = z
  .object({
    displayName: z.string().trim().min(1, "Ingrese su nombre").max(120),
    password: passwordSchema,
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    path: ["confirmation"],
    message: "Las contraseñas no coinciden",
  });

export type AcceptInvitationInput = z.infer<typeof acceptInvitationInputSchema>;

export const setUserPasswordInputSchema = z.object({
  password: passwordSchema,
});

export type SetUserPasswordInput = z.infer<typeof setUserPasswordInputSchema>;

export const signInInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingrese su contraseña"),
});

export type SignInInput = z.infer<typeof signInInputSchema>;

export const requestPasswordResetInputSchema = z.object({
  email: emailSchema,
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetInputSchema>;

export const resetPasswordInputSchema = z
  .object({
    password: passwordSchema,
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    path: ["confirmation"],
    message: "Las contraseñas no coinciden",
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
