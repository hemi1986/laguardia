/**
 * The dev server of the local browser tests (ST-083), started by Playwright (`playwright.config.ts`, webServer):
 * prepares `laguardia_e2e_test` – the previous run's uploads deleted from the bucket `laguardia-e2e`, created if
 * missing, reset, migrated, the e2e technician from E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD –, and only then starts
 * `next dev` on port 3100 with its own distDir `.next-e2e`, so it runs beside the developer's dev server on 3000
 * (Next.js allows one per distDir). DATABASE_URL, BETTER_AUTH_URL and the object store are set for it explicitly – they
 * override `.env.development.local`, so the development database and bucket are never touched.
 */
import { spawn } from "node:child_process";
import { join } from "node:path";
import { s3Settings, s3Storage } from "@/platform/storage";
import { e2eDatabaseUrl, prepareE2eDatabase } from "@/test-support/e2e-database";

const E2E_PORT = 3100; // playwright.config.ts waits for this port

/**
 * The browser tests' own bucket on the SeaweedFS of `docker-compose.yml` (ST-099), with its fixed development identity
 * – no cloud store, no Vercel login. `AWS_ROLE_ARN` is cleared, so no role from another environment is assumed.
 */
const E2E_STORE = {
  S3_BUCKET: "laguardia-e2e",
  S3_REGION: "us-east-1",
  S3_ENDPOINT: "http://localhost:8333",
  S3_ACCESS_KEY_ID: "laguardia-dev",
  S3_SECRET_ACCESS_KEY: "laguardia-dev-secret",
  AWS_ROLE_ARN: "",
};

async function main() {
  const database = e2eDatabaseUrl();
  const username = process.env.E2E_TEAM_USERNAME;
  const password = process.env.E2E_TEAM_PASSWORD;
  if (Boolean(username) !== Boolean(password)) {
    console.warn(
      "Only one of E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD is set – no e2e technician, the team-page tests skip.",
    );
  }
  await reachable(E2E_STORE.S3_ENDPOINT);
  const storage = s3Storage({ settings: s3Settings(E2E_STORE) });
  await prepareE2eDatabase(database, username && password ? { username, password } : undefined, storage);

  // `next` through Node itself – no `npx` layer, and it works without a shell on Windows too.
  const next = join(process.cwd(), "node_modules", "next", "dist", "bin", "next"); // Playwright starts us in the root
  const server = spawn(process.execPath, [next, "dev", "--port", String(E2E_PORT)], {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: database.toString(),
      BETTER_AUTH_URL: `http://localhost:${E2E_PORT}`,
      ...E2E_STORE,
    },
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.kill(signal));
  // Killed by a signal: not a clean end – the wrapper fails too.
  server.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

/** SeaweedFS not running fails here with what to do – not as an SDK error in the middle of the cleanup. */
async function reachable(endpoint: string): Promise<void> {
  try {
    await fetch(endpoint, { signal: AbortSignal.timeout(3000) });
  } catch {
    throw new Error(`No S3-compatible store at ${endpoint} – start it with \`npm run db:up\``);
  }
}

main().catch((error) => {
  // e.g. "No PostgreSQL at localhost:5433 – start it with `npm run db:up`", or the Team module's refusal
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
