import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@canmedseg/shared";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";

import { recordLogin } from "../admin/userAdminRepository";
import { config } from "../config";
import { pool } from "../database/pool";

/**
 * Ingreso con email + contraseña y administración de cuentas (RF-11).
 *
 * better-auth corre dentro de la API y persiste en nuestro Postgres: no hay
 * servicio externo ni telemetría. Usa la tabla `users` existente (con los campos
 * mapeados a sus columnas) y tablas propias para credenciales y sesiones; la
 * tabla `sessions` sigue siendo la del login con GUB UY.
 *
 * Los roles de la app viven en `user_roles`. `users.role` es solo el espejo que
 * el plugin admin necesita para autorizar sus endpoints (`admin` | `user`).
 */
export const auth = betterAuth({
  database: pool,
  basePath: "/api/auth",
  // La web llega a la API por el mismo origen (proxy de Vite en desarrollo).
  baseURL: config.WEB_BASE_URL,
  secret: config.BETTER_AUTH_SECRET,
  trustedOrigins: config.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
  telemetry: { enabled: false },
  emailAndPassword: {
    enabled: true,
    // Solo el administrador crea cuentas.
    disableSignUp: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },
  user: {
    modelName: "users",
    fields: {
      name: "display_name",
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    modelName: "auth_sessions",
    expiresIn: config.SESSION_TTL_HOURS * 60 * 60,
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    modelName: "auth_accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "auth_verifications",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await recordLogin(pool, session.userId);
        },
      },
    },
  },
  advanced: {
    cookiePrefix: "canmedseg",
    useSecureCookies: config.SESSION_COOKIE_SECURE,
    // Las PK de la base son uuid.
    database: { generateId: "uuid" },
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      bannedUserMessage:
        "Su cuenta está deshabilitada. Comuníquese con el administrador del sistema.",
      schema: {
        user: {
          fields: {
            banReason: "ban_reason",
            banExpires: "ban_expires",
          },
        },
        session: {
          fields: { impersonatedBy: "impersonated_by" },
        },
      },
    }),
  ],
});
