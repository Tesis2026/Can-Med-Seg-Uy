import { ROLE_LABELS, HEALTH_PROFESSION_SUBTYPE_LABELS } from "@canmedseg/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { config } from "../config";
import { pool } from "../database/pool";
import {
  base64UrlSha256,
  randomToken,
  safeEquals,
  signHs256Jwt,
  verifyHs256Jwt,
} from "./crypto";
import { MOCK_ACCOUNTS, findMockAccount, type MockAccount } from "./mockAccounts";

/**
 * IdP OIDC mock local (solo dev, AUTH_PROVIDER=mock).
 * Implementa discovery + authorization code flow con PKCE, para que pasar a GUB UY
 * real sea únicamente cambiar las variables OIDC_* (RNF-6.1).
 */

const CODE_TTL_MS = 2 * 60 * 1000;
const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;

const authorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().min(1),
  nonce: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(["S256"]).optional(),
});

const authorizeBodySchema = authorizeQuerySchema.extend({
  account_id: z.string().min(1),
});

const tokenBodySchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1),
  redirect_uri: z.string().url(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  code_verifier: z.string().min(1),
});

type CodeRow = {
  account_id: string;
  client_id: string;
  redirect_uri: string;
  nonce: string | null;
  code_challenge: string | null;
  code_challenge_method: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roleChips(account: MockAccount): string {
  return account.roles
    .map((entry) => {
      const label = ROLE_LABELS[entry.role];
      const subtype = entry.healthProfessionSubtype
        ? ` · ${HEALTH_PROFESSION_SUBTYPE_LABELS[entry.healthProfessionSubtype]}`
        : "";
      return `<span class="chip">${escapeHtml(label + subtype)}</span>`;
    })
    .join("");
}

function hiddenFields(query: z.infer<typeof authorizeQuerySchema>): string {
  const fields: Array<[string, string | undefined]> = [
    ["response_type", query.response_type],
    ["client_id", query.client_id],
    ["redirect_uri", query.redirect_uri],
    ["scope", query.scope],
    ["state", query.state],
    ["nonce", query.nonce],
    ["code_challenge", query.code_challenge],
    ["code_challenge_method", query.code_challenge_method],
  ];
  return fields
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}" />`)
    .join("");
}

function renderAccountPicker(query: z.infer<typeof authorizeQuerySchema>): string {
  const accounts = MOCK_ACCOUNTS.map(
    (account) => `
      <form method="post" action="/mock-idp/authorize" class="account">
        ${hiddenFields(query)}
        <input type="hidden" name="account_id" value="${escapeHtml(account.id)}" />
        <div class="accountInfo">
          <p class="name">${escapeHtml(account.fullName)}</p>
          <p class="meta">C.I. ${escapeHtml(account.documentNumber)} · ${escapeHtml(account.email)}</p>
          <p class="desc">${escapeHtml(account.description)}</p>
          <div class="chips">${roleChips(account)}</div>
        </div>
        <button type="submit">Ingresar</button>
      </form>`,
  ).join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Simulador de identidad digital gub.uy</title>
  <style>
    :root { color-scheme: light; }
    body { margin:0; font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
      background:#ebebeb; color:#222; }
    header { background:#1a4a8c; color:#fff; height:56px; display:flex; align-items:center;
      gap:16px; padding:0 20px; }
    header .logo { background:#fff; color:#1a4a8c; font-size:9px; font-weight:600; width:200px;
      height:56px; display:flex; align-items:center; justify-content:center; text-align:center; }
    header .title { font-size:16px; font-weight:600; }
    main { max-width:760px; margin:0 auto; padding:32px 20px 48px; }
    .card { background:#fff; padding:28px 32px; display:flex; flex-direction:column; gap:20px; }
    h1 { margin:0; font-size:24px; color:#222; }
    .lead { margin:0; color:#666; font-size:14px; }
    .account { background:#f5f5f5; padding:16px; display:flex; align-items:center; gap:16px; }
    .accountInfo { flex:1; min-width:0; }
    .name { margin:0; font-size:15px; font-weight:600; }
    .meta { margin:2px 0 0; font-size:12px; color:#888; }
    .desc { margin:6px 0 0; font-size:13px; color:#666; }
    .chips { margin-top:8px; display:flex; flex-wrap:wrap; gap:6px; }
    .chip { background:#e3ecf8; color:#1a4a8c; font-size:11px; font-weight:600;
      padding:3px 8px; border-radius:2px; }
    button { background:#1a4a8c; color:#fff; border:0; border-radius:2px; padding:12px 20px;
      font-size:14px; font-weight:600; cursor:pointer; }
    button:hover { filter:brightness(1.08); }
    footer { background:#e0e0e0; color:#888; font-size:11px; text-align:center; padding:12px; }
    @media (max-width:640px) { .account { flex-direction:column; align-items:stretch; }
      button { width:100%; } header .logo { width:120px; font-size:8px; } }
  </style>
</head>
<body>
  <header>
    <div class="logo">Identidad digital gub.uy</div>
  </header>
  <main>
    <div class="card">
      <h1>Elegí una cuenta de prueba</h1>
      <p class="lead">Acceso temporal, hasta conectar con gub.uy.</p>
      ${accounts}
    </div>
  </main>
  <footer>Farmacovigilancia - Ministerio de Salud Pública · IdP mock</footer>
</body>
</html>`;
}

function assertClient(clientId: string, redirectUri: string): void {
  if (clientId !== config.OIDC_CLIENT_ID) {
    throw new Error(`client_id desconocido: ${clientId}`);
  }
  if (redirectUri !== config.OIDC_REDIRECT_URI) {
    throw new Error(`redirect_uri no registrada: ${redirectUri}`);
  }
}

export const mockIdpRoutes: FastifyPluginAsync = async (app) => {
  app.get("/.well-known/openid-configuration", async (_request, reply) =>
    reply.send({
      issuer: config.OIDC_ISSUER,
      authorization_endpoint: config.OIDC_AUTHORIZATION_URL,
      token_endpoint: config.OIDC_TOKEN_URL,
      userinfo_endpoint: config.OIDC_USERINFO_URL,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      id_token_signing_alg_values_supported: ["HS256"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: config.OIDC_SCOPE.split(" "),
    }),
  );

  app.get("/authorize", async (request, reply) => {
    const query = authorizeQuerySchema.parse(request.query);
    assertClient(query.client_id, query.redirect_uri);
    return reply.type("text/html; charset=utf-8").send(renderAccountPicker(query));
  });

  app.post("/authorize", async (request, reply) => {
    const body = authorizeBodySchema.parse(request.body);
    assertClient(body.client_id, body.redirect_uri);

    const account = findMockAccount(body.account_id);
    if (!account) return reply.code(400).send({ message: "Cuenta de prueba inexistente" });

    const code = randomToken();
    await pool.query(
      `INSERT INTO auth_mock_authorization_codes (
         code, account_id, client_id, redirect_uri, nonce,
         code_challenge, code_challenge_method, expires_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7, now() + ($8 || ' milliseconds')::interval)`,
      [
        code,
        account.id,
        body.client_id,
        body.redirect_uri,
        body.nonce ?? null,
        body.code_challenge ?? null,
        body.code_challenge_method ?? null,
        String(CODE_TTL_MS),
      ],
    );

    const redirect = new URL(body.redirect_uri);
    redirect.searchParams.set("code", code);
    redirect.searchParams.set("state", body.state);
    return reply.redirect(redirect.toString(), 302);
  });

  app.post("/token", async (request, reply) => {
    const body = tokenBodySchema.parse(request.body);

    if (
      body.client_id !== config.OIDC_CLIENT_ID ||
      !safeEquals(body.client_secret, config.OIDC_CLIENT_SECRET)
    ) {
      return reply.code(401).send({ error: "invalid_client" });
    }

    const consumed = await pool.query<CodeRow>(
      `UPDATE auth_mock_authorization_codes
          SET consumed_at = now()
        WHERE code = $1 AND consumed_at IS NULL AND expires_at > now()
        RETURNING account_id, client_id, redirect_uri, nonce, code_challenge, code_challenge_method`,
      [body.code],
    );
    const row = consumed.rows[0];
    if (!row) return reply.code(400).send({ error: "invalid_grant" });

    if (row.redirect_uri !== body.redirect_uri || row.client_id !== body.client_id) {
      return reply.code(400).send({ error: "invalid_grant" });
    }
    if (row.code_challenge && base64UrlSha256(body.code_verifier) !== row.code_challenge) {
      return reply.code(400).send({ error: "invalid_grant", error_description: "PKCE inválido" });
    }

    const account = findMockAccount(row.account_id);
    if (!account) return reply.code(400).send({ error: "invalid_grant" });

    const issuedAt = Math.floor(Date.now() / 1000);
    const idToken = signHs256Jwt(
      {
        iss: config.OIDC_ISSUER,
        sub: account.subject,
        aud: config.OIDC_CLIENT_ID,
        iat: issuedAt,
        exp: issuedAt + ACCESS_TOKEN_TTL_SECONDS,
        nonce: row.nonce ?? undefined,
        email: account.email,
        nombre_completo: account.fullName,
      },
      config.OIDC_CLIENT_SECRET,
    );

    // El access_token del mock es un JWT firmado: userinfo lo verifica sin estado extra.
    const accessToken = signHs256Jwt(
      {
        iss: config.OIDC_ISSUER,
        sub: account.subject,
        aud: config.OIDC_ISSUER,
        account_id: account.id,
        iat: issuedAt,
        exp: issuedAt + ACCESS_TOKEN_TTL_SECONDS,
      },
      config.OIDC_CLIENT_SECRET,
    );

    return reply.send({
      access_token: accessToken,
      id_token: idToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: config.OIDC_SCOPE,
    });
  });

  app.get("/userinfo", async (request, reply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    if (!token) return reply.code(401).send({ error: "invalid_token" });

    const claims = verifyHs256Jwt(token, config.OIDC_CLIENT_SECRET);
    const accountId = typeof claims?.["account_id"] === "string" ? claims["account_id"] : null;
    const expiresAt = typeof claims?.["exp"] === "number" ? claims["exp"] : 0;
    if (!accountId || expiresAt * 1000 < Date.now()) {
      return reply.code(401).send({ error: "invalid_token" });
    }

    const account = findMockAccount(accountId);
    if (!account) return reply.code(401).send({ error: "invalid_token" });

    // Claims con los nombres que usa GUB UY, más los estándar de OIDC.
    return reply.send({
      sub: account.subject,
      email: account.email,
      email_verified: true,
      name: account.fullName,
      nombre_completo: account.fullName,
      primer_nombre: account.firstName,
      primer_apellido: account.lastName,
      given_name: account.firstName,
      family_name: account.lastName,
      tipo_documento: "ci",
      pais_documento: "uy",
      numero_documento: account.documentNumber,
      /** Claim propia del mock: roles a sembrar en el primer ingreso (dev). */
      canmedseg_roles: account.roles,
    });
  });
};
