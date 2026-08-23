/** Base de la API. Vacío = mismo origen (proxy /api de Vite en desarrollo). */
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Código de la API para distinguir causas (p. ej. `captcha_invalido`). */
    readonly reason?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  fallbackMessage?: string;
  /** Mantiene la petición viva si la página se descarta (autoguardado al salir). */
  keepalive?: boolean;
};

/**
 * `credentials: "include"` es imprescindible: la sesión viaja en una cookie
 * httpOnly y sin esto el reporte de un usuario logueado se guardaría como anónimo.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    fallbackMessage = "No se pudo completar la operación.",
    keepalive,
  } = options;

  const response = await fetch(apiUrl(path), {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive,
  });

  if (!response.ok) {
    let message = fallbackMessage;
    let reason: string | undefined;
    try {
      const payload = (await response.json()) as { message?: string; reason?: string };
      if (payload.message) message = payload.message;
      reason = payload.reason;
    } catch {
      // Un proxy caído puede devolver una respuesta sin JSON.
    }
    throw new ApiError(message, response.status, reason);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
