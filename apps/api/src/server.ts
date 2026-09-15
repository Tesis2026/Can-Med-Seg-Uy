import { buildApp } from "./app";
import { config } from "./config";
import { runMigrations } from "./database/migrate";
import { pool } from "./database/pool";
import { startPeriodicScheduler } from "./periodic/periodicScheduler";

async function start(): Promise<void> {
  if (config.RUN_MIGRATIONS) await runMigrations();

  const app = await buildApp();

  // Debe registrarse ANTES de listen(): Fastify no permite addHook con el server ya abierto.
  const stopScheduler = startPeriodicScheduler(pool, app.log);
  app.addHook("onClose", async () => stopScheduler());

  await app.listen({ host: config.HOST, port: config.PORT });
}

start().catch((error: unknown) => {
  console.error("No se pudo iniciar la API", error);
  process.exitCode = 1;
});
