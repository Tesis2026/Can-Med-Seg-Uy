import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, Role } from "@canmedseg/shared";
import { appInvite } from "@curedclick/app-invite";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";

import { assignInitialRoles, isUserActive, recordLogin } from "../admin/userAdminRepository";
import { config } from "../config";
import { pool } from "../database/pool";
import { sendEmail } from "../email/mailer";
import { passwordResetEmail } from "../email/templates";
import { INVITATION_TTL_MS, sendInvitationEmail } from "../invitations/invitationEmail";

const PASSWORD_RESET_TTL_SECONDS = 60 * 60;

async function sendPasswordResetEmail(input: {
  user: { id: string; email: string; name: string };
  token: string;
}): Promise<void> {
  try {
    if (!(await isUserActive(pool, input.user.id))) return;

    const url = new URL("/restablecer-contrasena", config.WEB_BASE_URL);
    url.searchParams.set("token", input.token);

    await sendEmail(
      passwordResetEmail({
        to: input.user.email,
        name: input.user.name,
        url: url.toString(),
        expiresInMinutes: PASSWORD_RESET_TTL_SECONDS / 60,
      }),
    );
  } catch (error) {
    console.error("No se pudo enviar el email de recuperación de contraseña", error);
  }
}

export const auth = betterAuth({
  database: pool,
  basePath: "/api/auth",
  baseURL: config.WEB_BASE_URL,
  secret: config.BETTER_AUTH_SECRET,
  trustedOrigins: config.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
  telemetry: { enabled: false },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    resetPasswordTokenExpiresIn: PASSWORD_RESET_TTL_SECONDS,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: sendPasswordResetEmail,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 10 },
    },
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
    // Alta por invitación: solo el admin invita, y toda cuenta invitada es Investigador.
    appInvite({
      invitationExpiresIn: INVITATION_TTL_MS,
      // Las vencidas se conservan para poder reenviarlas desde Gestión de usuarios.
      cleanupExpiredInvitations: false,
      autoSignIn: true,
      canCreateInvitation: (ctx) => ctx.context.session?.user.role === "admin",
      canCancelInvitation: (ctx) => ctx.context.session?.user.role === "admin",
      async sendInvitationEmail(invitation) {
        if (!invitation.email) return;
        await sendInvitationEmail({
          invitationId: invitation.id,
          email: invitation.email,
          inviterName: invitation.inviter.name,
        });
      },
      hooks: {
        accept: {
          before: (_ctx, user) => {
            if (!user.name?.trim()) {
              throw new APIError("BAD_REQUEST", { code: "NAME_REQUIRED", message: "Ingrese su nombre" });
            }
          },
          after: async (_ctx, { invitation, user }) => {
            await assignInitialRoles(
              pool,
              user.id,
              [{ role: Role.Investigador, healthProfessionSubtype: null }],
              invitation.inviterId,
            );
          },
        },
      },
      schema: {
        appInvitation: {
          modelName: "app_invitations",
          fields: {
            inviterId: "inviter_id",
            expiresAt: "expires_at",
            domainWhitelist: "domain_whitelist",
          },
        },
      },
    }),
  ],
});
