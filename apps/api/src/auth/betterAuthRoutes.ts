import type { FastifyPluginAsync } from "fastify";

import { auth } from "./betterAuth";

/**
 * Endpoints de better-auth que la web usa directamente. El resto (alta, baja,
 * contraseñas, activación) se invoca del lado servidor desde las rutas de
 * administración, detrás de los guards de la app.
 */
const PUBLIC_ENDPOINTS = ["/auth/sign-in/email", "/auth/sign-out", "/auth/get-session"];

/**
 * Traduce la request de Fastify a la Fetch API que espera `auth.handler`.
 * Las rutas explícitas de authRoutes (`/auth/session`, `/auth/logout`, …) tienen
 * prioridad sobre este comodín en el router de Fastify.
 */
export const betterAuthRoutes: FastifyPluginAsync = async (app) => {
  for (const path of PUBLIC_ENDPOINTS) {
    app.route({
      method: ["GET", "POST"],
      url: path,
      async handler(request, reply) {
        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (value === undefined) continue;
          headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }

        // El body se vuelve a serializar: el largo original ya no aplica.
        headers.delete("content-length");
        headers.delete("transfer-encoding");
        const hasBody = request.method !== "GET" && request.body !== undefined;
        if (hasBody) headers.set("content-type", "application/json");

        const response = await auth.handler(
          new Request(new URL(request.url, `http://${request.headers.host ?? "localhost"}`), {
            method: request.method,
            headers,
            body: hasBody ? JSON.stringify(request.body) : undefined,
          }),
        );

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          if (key !== "set-cookie") reply.header(key, value);
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length > 0) reply.header("set-cookie", cookies);

        return reply.send(response.body ? await response.text() : null);
      },
    });
  }
};
