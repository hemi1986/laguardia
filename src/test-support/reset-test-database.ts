import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { testDatabaseUrl } from "./database";

/**
 * Vitest global setup of the integration project: creates the test database if it is missing, drops everything
 * in it and applies all migrations from `drizzle/` – every test run starts from the same empty schema.
 */
export default async function resetTestDatabase(): Promise<void> {
  const url = new URL(testDatabaseUrl());
  const name = url.pathname.slice(1);
  if (!/_test$/.test(name)) throw new Error(`Refusing to reset "${name}" – the test database name must end in _test`);

  await createIfMissing(url, name);

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public");
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    await client.end();
  }
}

async function createIfMissing(url: URL, name: string): Promise<void> {
  const server = new URL(url);
  server.pathname = "/postgres";
  const client = new Client({ connectionString: server.toString() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(`No PostgreSQL at ${url.host} – start it with \`npm run db:up\``, { cause: error });
  }
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rowCount) await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
}
