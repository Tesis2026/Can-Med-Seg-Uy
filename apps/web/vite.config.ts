import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  // El .env vive en la raíz del monorepo (mismo archivo que lee la API).
  const env = loadEnv(mode, repoRoot, "");
  const apiTarget = env.API_PROXY_TARGET ?? "http://localhost:3000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@canmedseg/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": apiTarget,
        // IdP mock local: el navegador lo alcanza por el mismo origen que la web.
        "/mock-idp": apiTarget,
        "/health": apiTarget,
      },
      fs: {
        allow: [repoRoot],
      },
    },
  };
});
