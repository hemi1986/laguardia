import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { testDatabaseUrl } from "./database";
import { resetDatabase } from "./reset-test-database";

/**
 * A database of its own for tests of a rule over a whole set – e.g. the museum number, unique among all machines
 * (HS-17): "the highest museum number is LG-041" cannot be arranged in the database every test shares. Named
 * `laguardia_<name>_test` next to the shared one, dropped and migrated when a test file calls `reset()`.
 */
export function isolatedTestDatabase(name: string) {
  const url = new URL(testDatabaseUrl());
  url.pathname = `/laguardia_${name}_test`;
  let pool: Pool | undefined;
  return {
    url,
    /** Drops everything and applies the migrations – all of them, or up to and including `upTo` (a migration tag). */
    async reset(upTo?: string): Promise<NodePgDatabase> {
      await pool?.end();
      await resetDatabase(url, upTo ? migrationsUpTo(upTo) : "drizzle");
      pool = new Pool({ connectionString: url.toString(), max: 4 });
      return drizzle(pool);
    },
    async close(): Promise<void> {
      await pool?.end();
      pool = undefined;
    },
  };
}

/** A copy of `drizzle/` whose journal ends with the migration `tag` – the schema as it was at that point. */
function migrationsUpTo(tag: string): string {
  const folder = mkdtempSync(join(tmpdir(), "laguardia-migrations-"));
  cpSync("drizzle", folder, { recursive: true });
  const journalFile = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalFile, "utf8")) as { entries: { tag: string }[] };
  const end = journal.entries.findIndex((entry) => entry.tag === tag);
  if (end < 0) throw new Error(`No migration "${tag}" in drizzle/`);
  writeFileSync(journalFile, JSON.stringify({ ...journal, entries: journal.entries.slice(0, end + 1) }));
  return folder;
}
