import type { FastifyPluginAsync } from "fastify";

import { auth } from "./betterAuth";

const PUBLIC_ENDPOINTS = [
  "/auth/sign-in/email",
  "/auth/sign-out",
  "/auth/get-session",
  "/auth/request-password-reset",
  "/auth/reset-password",
];

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

        if (!headers.has("x-forwarded-for")) headers.set("x-forwarded-for", request.ip);

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
