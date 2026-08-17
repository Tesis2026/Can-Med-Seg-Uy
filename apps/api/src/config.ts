import { fileURLToPath } from "node:url";

import { config as loadEnvironment } from "dotenv";
import { z } from "zod";

loadEnvironment({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).default("postgresql://canmedseg:canmedseg@localhost:5432/canmedseg"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  RUN_MIGRATIONS: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
});

export const config = environmentSchema.parse(process.env);
