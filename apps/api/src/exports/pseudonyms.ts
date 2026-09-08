import { createHmac, randomBytes } from "node:crypto";

import type { Pool } from "pg";

import { config } from "../config";

/**
 * Seudónimos de personas para las exportaciones (RF-8.2, RF-8.7, RF-8.8).
 *
 * La tabla guarda el **hash** del documento, nunca la cédula: si alguien lee
 * `person_pseudonyms` no puede recuperar identidades, y aun así el mismo
 * documento produce siempre el mismo seudónimo, incluso entre exportaciones
 * distintas.
 */

/** Normaliza el documento para que 1.234.567-8 y 12345678 sean la misma persona. */
function normalizeDocument(document: string): string {
  return document.replace(/[^0-9kK]/g, "").toUpperCase();
}

function documentHash(document: string): string {
  return createHmac("sha256", config.PSEUDONYM_SECRET)
    .update(normalizeDocument(document))
    .digest("hex");
}

function newPseudonym(): string {
  return `P-${randomBytes(5).toString("hex").toUpperCase()}`;
}

/**
 * Devuelve el seudónimo de cada documento, creándolo la primera vez. Resuelve
 * todos los documentos de una exportación en una sola pasada.
 */
export async function resolvePseudonyms(
  pool: Pool,
  documents: readonly string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  const wanted = new Map<string, string>();
  for (const document of documents) {
    const normalized = normalizeDocument(document);
    if (!normalized) continue;
    wanted.set(documentHash(document), document);
  }
  if (wanted.size === 0) return result;

  const hashes = [...wanted.keys()];
  const existing = await pool.query<{ document_hash: string; pseudonym: string }>(
    `SELECT document_hash, pseudonym FROM person_pseudonyms WHERE document_hash = ANY($1::text[])`,
    [hashes],
  );

  const known = new Map(existing.rows.map((row) => [row.document_hash, row.pseudonym]));
  const missing = hashes.filter((hash) => !known.has(hash));

  for (const hash of missing) {
    // `ON CONFLICT` cubre la carrera entre dos exportaciones simultáneas.
    const inserted = await pool.query<{ pseudonym: string }>(
      `INSERT INTO person_pseudonyms (document_hash, pseudonym)
            VALUES ($1, $2)
       ON CONFLICT (document_hash) DO UPDATE SET document_hash = EXCLUDED.document_hash
         RETURNING pseudonym`,
      [hash, newPseudonym()],
    );
    const pseudonym = inserted.rows[0]?.pseudonym;
    if (pseudonym) known.set(hash, pseudonym);
  }

  for (const [hash, document] of wanted) {
    const pseudonym = known.get(hash);
    if (pseudonym) result.set(document, pseudonym);
  }
  return result;
}
