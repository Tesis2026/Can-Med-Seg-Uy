import { buildApp } from "./app";
import { config } from "./config";
import { runMigrations } from "./database/migrate";
import { pool } from "./database/pool";
import { startPeriodicScheduler } from "./periodic/periodicScheduler";

async function start(): Promise<void> {
  if (config.RUN_MIGRATIONS) await runMigrations();

  const app = await buildApp();
  await app.listen({ host: config.HOST, port: config.PORT });

  // Reportes periódicos a investigadores (RF-8.3).
  const stopScheduler = startPeriodicScheduler(pool, app.log);
  app.addHook("onClose", async () => stopScheduler());
}

start().catch((error: unknown) => {
  console.error("No se pudo iniciar la API", error);
  process.exitCode = 1;
});
