import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { Pool } from "pg";

/** A database handle or an open transaction – what persistence functions of the modules accept. */
export type Database = PgDatabase<NodePgQueryResultHKT>;

let db: NodePgDatabase | undefined;

/**
 * One pool per function instance; DATABASE_URL is set per environment by the Neon integration.
 * attachDatabasePool lets Fluid compute close idle connections before an instance is suspended.
 */
export function database(): NodePgDatabase {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    const pool = new Pool({ connectionString, max: 5 });
    attachDatabasePool(pool);
    db = drizzle(pool);
  }
  return db;
}
