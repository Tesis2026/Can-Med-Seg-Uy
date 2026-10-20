import { pool } from "./helpers";

export async function teardown(): Promise<void> {
  await pool.end();
}
