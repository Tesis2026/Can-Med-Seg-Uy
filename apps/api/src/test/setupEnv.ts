/**
 * Debe cargarse antes que config/pool (vitest setupFiles).
 *
 * IMPORTANTE: los tests hacen TRUNCATE de tablas de la DB apuntada por
 * DATABASE_URL / TEST_DATABASE_URL. Preferí una DB dedicada si podés;
 * si no, re-sembrá usuarios después de `npm test`.
 */
import { config as loadEnvironment } from "dotenv";
import { fileURLToPath } from "node:url";

loadEnvironment({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

const testUrl = process.env.TEST_DATABASE_URL?.trim();
if (testUrl) {
  process.env.DATABASE_URL = testUrl;
}

process.env.NODE_ENV = "test";
process.env.RUN_MIGRATIONS = "false";
process.env.PERIODIC_REPORTS_ENABLED = "false";
process.env.AUTH_PROVIDER = "mock";
process.env.SESSION_COOKIE_SECURE = "false";
if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
  process.env.BETTER_AUTH_SECRET = "canmedseg-better-auth-secreto-local-dev";
}
