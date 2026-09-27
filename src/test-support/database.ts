import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/** Local default: the docker compose PostgreSQL (`npm run db:up`), database `laguardia_test`. CI sets its own. */
export function testDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? "postgres://laguardia:laguardia@localhost:5433/laguardia_test";
}

let db: NodePgDatabase | undefined;

/** The database of integration tests – never DATABASE_URL, so a test run can't touch a real environment. */
export function testDatabase(): NodePgDatabase {
  db ??= drizzle(new Pool({ connectionString: testDatabaseUrl(), max: 2 }));
  return db;
}
