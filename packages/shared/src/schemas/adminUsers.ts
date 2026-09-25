import { z } from "zod";

import { Role } from "../enums/role";
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

export const createUserInputSchema = z
  .object({
    displayName: z.string().trim().min(1, "Ingrese el nombre").max(120),
    email: z.string().trim().toLowerCase().email("Ingrese un email válido"),
    password: passwordSchema,
    roles: z.array(userRoleSchema),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.roles.forEach((entry, index) => {
      if (seen.has(entry.role)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roles", index],
          message: "Rol repetido",
        });
      }
      seen.add(entry.role);
      if (entry.role === Role.ProfesionalSalud && entry.healthProfessionSubtype === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roles", index, "healthProfessionSubtype"],
          message: "Seleccione el tipo de profesional de la salud",
        });
      }
    });
  });

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const setUserPasswordInputSchema = z.object({
  password: passwordSchema,
});

export type SetUserPasswordInput = z.infer<typeof setUserPasswordInputSchema>;

export const signInInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingrese un email válido"),
  password: z.string().min(1, "Ingrese su contraseña"),
});

export type SignInInput = z.infer<typeof signInInputSchema>;
