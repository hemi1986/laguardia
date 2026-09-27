import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let db: NodePgDatabase | undefined;

/** One pool per function instance; DATABASE_URL is set per environment by the Neon integration. */
export function database(): NodePgDatabase {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    db = drizzle(new Pool({ connectionString, max: 5 }));
  }
  return db;
}
