import { z } from "zod";

import { PERMISSIONS, permissionsForRoles } from "../auth/permissions";
import type { Permission as PermissionType } from "../auth/permissions";
import {
  HEALTH_PROFESSION_SUBTYPES,
  type HealthProfessionSubtype as HealthProfessionSubtypeType,
} from "../enums/health-profession";
import { ASSIGNABLE_ROLES, ROLES, Role } from "../enums/role";
import type { AssignableRole as AssignableRoleType, Role as RoleType } from "../enums/role";

export const roleSchema = z.enum(ROLES as [RoleType, ...RoleType[]]);

export const assignableRoleSchema = z.enum(
  ASSIGNABLE_ROLES as unknown as [AssignableRoleType, ...AssignableRoleType[]],
);

export const healthProfessionSubtypeSchema = z.enum(
  HEALTH_PROFESSION_SUBTYPES as [HealthProfessionSubtypeType, ...HealthProfessionSubtypeType[]],
);

export const permissionSchema = z.enum(
  PERMISSIONS as [PermissionType, ...PermissionType[]],
);

/** Rol asignado a un usuario; el subtipo solo aplica a `profesional_salud`. */
export const userRoleSchema = z
  .object({
    role: assignableRoleSchema,
    healthProfessionSubtype: healthProfessionSubtypeSchema.nullable().default(null),
  })
  .superRefine((value, context) => {
    if (value.role !== Role.ProfesionalSalud && value.healthProfessionSubtype !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["healthProfessionSubtype"],
        message: "El subtipo solo aplica al rol profesional de la salud",
      });
    }
  });

export type UserRole = z.infer<typeof userRoleSchema>;

export const sessionUserSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  email: z.string().nullable(),
  documentNumber: z.string().nullable(),
  roles: z.array(userRoleSchema),
  permissions: z.array(permissionSchema),
  consentAcceptedAt: z.string().datetime().nullable(),
  consentVersion: z.string().nullable(),
  firstLoginAt: z.string().datetime().nullable(),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

/** Respuesta de `GET /api/auth/session`. Un visitante también recibe sus permisos. */
export const sessionSchema = z.discriminatedUnion("authenticated", [
  z.object({
    authenticated: z.literal(false),
    roles: z.array(roleSchema),
    permissions: z.array(permissionSchema),
  }),
  z.object({
    authenticated: z.literal(true),
    user: sessionUserSchema,
    expiresAt: z.string().datetime(),
    roles: z.array(roleSchema),
    permissions: z.array(permissionSchema),
  }),
]);

export type Session = z.infer<typeof sessionSchema>;

export const anonymousSession = (): Session => ({
  authenticated: false,
  roles: [Role.Anonimo],
  permissions: permissionsForRoles([Role.Anonimo]),
});

export const acceptConsentInputSchema = z.object({
  version: z.string().min(1),
});

export type AcceptConsentInput = z.infer<typeof acceptConsentInputSchema>;
