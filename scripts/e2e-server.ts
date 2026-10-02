/**
 * The dev server of the local browser tests (ST-083), started by Playwright (`playwright.config.ts`, webServer):
 * prepares `laguardia_e2e_test` – created if missing, reset, migrated, the e2e technician from E2E_TEAM_USERNAME /
 * E2E_TEAM_PASSWORD –, and only then starts `next dev` on port 3100 with its own distDir `.next-e2e`, so it runs beside
 * the developer's dev server on 3000 (Next.js allows one per distDir). DATABASE_URL and BETTER_AUTH_URL are set for it
 * explicitly – they override `.env.development.local`, so the development database is never touched.
 */
import { spawn } from "node:child_process";
import { e2eDatabaseUrl, prepareE2eDatabase } from "@/test-support/e2e-database";

export const E2E_PORT = 3100;

async function main() {
  const database = e2eDatabaseUrl();
  const username = process.env.E2E_TEAM_USERNAME;
  const password = process.env.E2E_TEAM_PASSWORD;
  await prepareE2eDatabase(database, username && password ? { username, password } : undefined);

  const server = spawn("npx", ["next", "dev", "--port", String(E2E_PORT)], {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: database.toString(),
      BETTER_AUTH_URL: `http://localhost:${E2E_PORT}`,
    },
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.kill(signal));
  server.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  // e.g. "No PostgreSQL at localhost:5433 – start it with `npm run db:up`", or the Team module's refusal
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
