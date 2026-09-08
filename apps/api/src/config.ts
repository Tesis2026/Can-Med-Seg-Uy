import { fileURLToPath } from "node:url";

import { config as loadEnvironment } from "dotenv";
import { z } from "zod";

loadEnvironment({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const booleanFlag = (fallback: "true" | "false") =>
  z.enum(["true", "false"]).default(fallback).transform((value) => value === "true");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).default("postgresql://canmedseg:canmedseg@localhost:5432/canmedseg"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  RUN_MIGRATIONS: booleanFlag("true"),

  /** Base pública de la web; se usa para redirigir después del login/logout. */
  WEB_BASE_URL: z.string().url().default("http://localhost:5173"),

  /** Sesión (cookie httpOnly con token opaco). */
  SESSION_COOKIE_NAME: z.string().min(1).default("canmedseg_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  SESSION_COOKIE_SECURE: booleanFlag("false"),
  SESSION_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),

  /**
   * Proveedor de identidad. `mock` levanta el IdP local en /mock-idp;
   * `gubuy` usa los endpoints reales (solo cambian estas variables — RNF-6).
   */
  AUTH_PROVIDER: z.enum(["mock", "gubuy"]).default("mock"),
  OIDC_ISSUER: z.string().min(1).default("http://localhost:5173/mock-idp"),
  OIDC_CLIENT_ID: z.string().min(1).default("canmedseg-local"),
  OIDC_CLIENT_SECRET: z.string().min(1).default("canmedseg-local-secret"),
  OIDC_SCOPE: z.string().min(1).default("openid email profile document"),
  /** URL a la que se redirige el navegador (debe ser alcanzable desde el cliente). */
  OIDC_AUTHORIZATION_URL: z.string().url().default("http://localhost:5173/mock-idp/authorize"),
  /** URLs servidor-a-servidor. */
  OIDC_TOKEN_URL: z.string().url().default("http://127.0.0.1:3000/mock-idp/token"),
  OIDC_USERINFO_URL: z.string().url().default("http://127.0.0.1:3000/mock-idp/userinfo"),
  /** Debe apuntar a GET /api/auth/callback tal como lo ve el navegador. */
  OIDC_REDIRECT_URI: z.string().url().default("http://localhost:5173/api/auth/callback"),
  /** Minutos de validez del state/nonce del authorization code flow. */
  OIDC_LOGIN_STATE_TTL_MINUTES: z.coerce.number().int().positive().default(10),

  /**
   * Solo dev: siembra los roles declarados por la cuenta mock la primera vez que
   * entra. En producción los roles solo los otorga el administrador (RF-2.4).
   */
  MOCK_IDP_SEED_ROLES: booleanFlag("true"),

  /** CAPTCHA del envío anónimo (RF-3.6). */
  CAPTCHA_CHALLENGE_TTL_MINUTES: z.coerce.number().int().positive().default(5),
  /** Validez del comprobante emitido al resolverlo, hasta enviar el reporte. */
  CAPTCHA_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(20),
  CAPTCHA_MAX_ATTEMPTS: z.coerce.number().int().positive().default(4),

  /** Caducidad de los borradores por inactividad (RF-4 / plan-arquitectura.md). */
  DRAFT_RETENTION_DAYS: z.coerce.number().int().positive().default(90),

  /**
   * Clave del seudónimo de exportaciones (RF-8.2). Debe ser estable: cambiarla
   * rompe la correspondencia entre los archivos ya exportados y los nuevos.
   */
  PSEUDONYM_SECRET: z.string().min(16).default("canmedseg-pseudonimo-local-dev"),
});

export const config = environmentSchema.parse(process.env);

export const isMockIdentityProvider = config.AUTH_PROVIDER === "mock";

export const sessionTtlMs = config.SESSION_TTL_HOURS * 60 * 60 * 1000;

export const loginStateTtlMs = config.OIDC_LOGIN_STATE_TTL_MINUTES * 60 * 1000;

export const captchaChallengeTtlMs = config.CAPTCHA_CHALLENGE_TTL_MINUTES * 60 * 1000;

export const captchaTokenTtlMs = config.CAPTCHA_TOKEN_TTL_MINUTES * 60 * 1000;

export const draftRetentionMs = config.DRAFT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
