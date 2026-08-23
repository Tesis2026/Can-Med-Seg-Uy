import { config } from "../config";
import { base64UrlSha256, randomToken, verifyHs256Jwt } from "./crypto";

/** Identidad normalizada que devuelve el proveedor (mock o GUB UY real). */
export type ExternalIdentity = {
  subject: string;
  displayName: string;
  email: string | null;
  documentNumber: string | null;
  /** Roles sugeridos por el IdP mock (dev). GUB UY real no envía roles. */
  mockRoles: MockRoleClaim[];
};

export type MockRoleClaim = {
  role: string;
  healthProfessionSubtype: string | null;
};

export type LoginChallenge = {
  authorizationUrl: string;
  state: string;
  nonce: string;
  codeVerifier: string;
};

/** Authorization Code Flow + PKCE (S256). */
export function createLoginChallenge(): LoginChallenge {
  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken(48);

  const url = new URL(config.OIDC_AUTHORIZATION_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.OIDC_CLIENT_ID);
  url.searchParams.set("redirect_uri", config.OIDC_REDIRECT_URI);
  url.searchParams.set("scope", config.OIDC_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", base64UrlSha256(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");

  return { authorizationUrl: url.toString(), state, nonce, codeVerifier };
}

export class OidcError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "OidcError";
  }
}

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
};

async function postForm(url: string, body: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(body).toString(),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new OidcError(`El proveedor de identidad respondió ${response.status}`, payload);
  }
  return payload;
}

function claimString(claims: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = claims[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function readMockRoles(claims: Record<string, unknown>): MockRoleClaim[] {
  const raw = claims["canmedseg_roles"];
  if (!Array.isArray(raw)) return [];
  const roles: MockRoleClaim[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as { role?: unknown; healthProfessionSubtype?: unknown };
    if (typeof candidate.role !== "string") continue;
    roles.push({
      role: candidate.role,
      healthProfessionSubtype:
        typeof candidate.healthProfessionSubtype === "string"
          ? candidate.healthProfessionSubtype
          : null,
    });
  }
  return roles;
}

/**
 * Nombres de claim de GUB UY (`nombre_completo`, `numero_documento`, …) con
 * fallback a los claims estándar de OIDC.
 */
function toIdentity(claims: Record<string, unknown>): ExternalIdentity {
  const subject = claimString(claims, "sub");
  if (!subject) throw new OidcError("El proveedor de identidad no devolvió `sub`");

  const givenName = claimString(claims, "primer_nombre", "given_name");
  const familyName = claimString(claims, "primer_apellido", "family_name");
  const fullName =
    claimString(claims, "nombre_completo", "name") ??
    [givenName, familyName].filter(Boolean).join(" ").trim();

  return {
    subject,
    displayName: fullName || claimString(claims, "email") || "Usuario gub.uy",
    email: claimString(claims, "email"),
    documentNumber: claimString(claims, "numero_documento", "document_number"),
    mockRoles: readMockRoles(claims),
  };
}

export async function exchangeCodeForIdentity(input: {
  code: string;
  codeVerifier: string;
  nonce: string;
}): Promise<ExternalIdentity> {
  const tokens = (await postForm(config.OIDC_TOKEN_URL, {
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: config.OIDC_REDIRECT_URI,
    client_id: config.OIDC_CLIENT_ID,
    client_secret: config.OIDC_CLIENT_SECRET,
    code_verifier: input.codeVerifier,
  })) as TokenResponse | null;

  const accessToken = tokens?.access_token;
  if (!accessToken) throw new OidcError("El proveedor de identidad no devolvió access_token");

  // El id_token del mock es HS256 y se valida acá (incluido el nonce).
  // Con GUB UY real (RS256) `verifyHs256Jwt` devuelve null y la identidad se toma
  // de userinfo sobre TLS; validar RS256 vía JWKS queda pendiente para el IdP real.
  if (tokens.id_token) {
    const idClaims = verifyHs256Jwt(tokens.id_token, config.OIDC_CLIENT_SECRET);
    if (idClaims) {
      if (idClaims["nonce"] !== input.nonce) {
        throw new OidcError("El nonce del id_token no coincide con el de la solicitud");
      }
      if (idClaims["aud"] !== config.OIDC_CLIENT_ID) {
        throw new OidcError("El id_token fue emitido para otro cliente");
      }
    }
  }

  const response = await fetch(config.OIDC_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof payload !== "object" || payload === null) {
    throw new OidcError(`userinfo respondió ${response.status}`, payload);
  }

  return toIdentity(payload as Record<string, unknown>);
}
