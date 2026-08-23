import { config } from "../config";

/**
 * Helpers de cookie sin dependencias: `@fastify/cookie` v11 arrastra `cookie@2`,
 * que exige Node >= 22 y el repo declara Node >= 20.
 */
export function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

type CookieOptions = {
  maxAgeSeconds?: number;
  expires?: Date;
};

export function serializeSessionCookie(value: string, options: CookieOptions = {}): string {
  const attributes = [
    `${config.SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${config.SESSION_COOKIE_SAME_SITE === "lax" ? "Lax" : config.SESSION_COOKIE_SAME_SITE === "strict" ? "Strict" : "None"}`,
  ];
  if (config.SESSION_COOKIE_SECURE) attributes.push("Secure");
  if (options.maxAgeSeconds !== undefined) {
    attributes.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }
  if (options.expires) attributes.push(`Expires=${options.expires.toUTCString()}`);
  return attributes.join("; ");
}

export function clearedSessionCookie(): string {
  return serializeSessionCookie("", { maxAgeSeconds: 0, expires: new Date(0) });
}
