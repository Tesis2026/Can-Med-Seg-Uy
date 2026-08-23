import { buildApp } from "./app";
import { config } from "./config";
import { runMigrations } from "./database/migrate";

async function start(): Promise<void> {
  if (config.RUN_MIGRATIONS) await runMigrations();

  const app = await buildApp();
  await app.listen({ host: config.HOST, port: config.PORT });
}

start().catch((error: unknown) => {
  console.error("No se pudo iniciar la API", error);
  process.exitCode = 1;
});
