import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Token opaco para la cookie de sesión y para state/nonce/PKCE. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** En base de datos solo se guarda el hash del token de sesión. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function base64UrlSha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

type JwtClaims = Record<string, unknown>;

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/**
 * Firma HS256 mínima para el `id_token` del IdP mock (evita sumar dependencias).
 * Con GUB UY real el id_token viene firmado RS256 por el proveedor; ver
 * `verifyHs256Jwt` para el alcance de la validación local.
 */
export function signHs256Jwt(claims: JwtClaims, secret: string): string {
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson(claims);
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/**
 * Verifica un JWT HS256 y devuelve sus claims. Devuelve `null` si el algoritmo no
 * es HS256 (p. ej. RS256 de GUB UY real) o si la firma no coincide: el llamador
 * decide si eso es un error o si sigue con la llamada a userinfo.
 */
export function verifyHs256Jwt(token: string, secret: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];

  let algorithm: unknown;
  try {
    algorithm = (JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as JwtClaims).alg;
  } catch {
    return null;
  }
  if (algorithm !== "HS256") return null;

  const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  if (!safeEquals(signature, expected)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JwtClaims;
  } catch {
    return null;
  }
}
