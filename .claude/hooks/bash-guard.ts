/**
 * PreToolUse hook (Bash): blocks commands that are hard to undo. The user can still run them
 * themselves (`! <command>` in the prompt).
 *
 * - force pushes (`--force-with-lease` is allowed, except onto main)
 * - production deployments from the CLI (`vercel --prod`, `vercel promote`)
 * - destructive database commands unless they clearly target a local database
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../lib/discovery.ts";

let data: Record<string, any>;
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const cmd: unknown = data.tool_input?.command;
if (typeof cmd !== "string" || !cmd) process.exit(0);

function block(msg: string): never {
  process.stderr.write(`Blocked: ${msg} If this is really intended, ask the user to run it themselves.\n`);
  process.exit(2);
}

const LOCAL_DB = /(localhost|127\.0\.0\.1|\[::1\]|@db:|@postgres:|\.local\b)/;

/** DATABASE_URL the command would use: inline assignment, else the project's .env files, else the environment. */
function databaseUrl(): string {
  const inline = /\b(?:DATABASE_URL|POSTGRES_URL)=("[^"]*"|'[^']*'|\S+)/.exec(cmd as string)?.[1];
  if (inline) return inline;
  for (const f of [".env.local", ".env.development.local", ".env"]) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    const m = /^\s*(?:DATABASE_URL|POSTGRES_URL)\s*=\s*(.+)$/m.exec(readFileSync(p, "utf8"));
    if (m) return m[1];
  }
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

for (const part of cmd.split(/&&|\|\||;|\n/)) {
  const c = part.trim();

  if (/\bgit\s+push\b/.test(c)) {
    if (/(\s--force(?!-with-lease)\b|\s-f\b|\s\+\S+)/.test(c)) block("force push.");
    if (/--force-with-lease/.test(c) && /\b(main|master)\b/.test(c)) block("force push onto main.");
  }

  if (/\bvercel\b/.test(c) && (/\s--prod\b/.test(c) || /\bvercel\s+promote\b/.test(c))) {
    block("production deployment from the CLI – production deploys only via merge to main.");
  }

  const destructive =
    /\b(prisma\s+migrate\s+reset|prisma\s+db\s+push\b.*--force-reset|drizzle-kit\s+drop|dropdb)\b/i.test(c) ||
    (/\b(psql|pgcli|prisma|drizzle-kit|sql)\b/i.test(c) && /\b(DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE)\b/i.test(c));
  if (destructive && !LOCAL_DB.test(c) && !LOCAL_DB.test(databaseUrl())) {
    block("destructive database command and the target database is not clearly local.");
  }
}
process.exit(0);
