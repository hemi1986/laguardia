/**
 * SessionStart hook: what a fresh checkout is still missing (only what is missing),
 * and where the engineering work stands – branch, stories in progress, the next story,
 * and the last verify result.
 *
 * The setup checks run before anything is imported from .claude/lib, so they still
 * work when the tooling dependencies are not installed yet.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

/** Runs a command with stderr folded into stdout; `ok` is the exit status. */
function sh(command: string): { ok: boolean; out: string } {
  try {
    return { ok: true, out: execSync(`${command} 2>&1`, { cwd: root, encoding: "utf8", timeout: 5000 }).trim() };
  } catch (e) {
    const err = e as { stdout?: string };
    return { ok: false, out: (err.stdout ?? "").trim() };
  }
}

/** Is the Vercel MCP server from .mcp.json approved for this project? undefined = can't tell. */
function vercelMcpApproved(): boolean | undefined {
  try {
    const config = join(homedir(), ".claude.json");
    if (statSync(config).size > 50_000_000) return undefined;
    const project = JSON.parse(readFileSync(config, "utf8")).projects?.[root] ?? {};
    return Boolean(project.mcpServers?.vercel) || (project.enabledMcpjsonServers ?? []).includes("vercel");
  } catch {
    return undefined;
  }
}

function setupHints(): string[] {
  const hints: string[] = [];

  if (!existsSync(join(root, ".claude/node_modules/yaml")))
    hints.push("- Tooling dependencies are missing – the validators and scripts won't run: `npm install --prefix .claude`");
  if (existsSync(join(root, "package.json")) && !existsSync(join(root, "node_modules")))
    hints.push("- The application's dependencies are missing: `npm install`");

  if (!sh("command -v gh").ok) {
    hints.push("- GitHub CLI (`gh`) not installed – /implement can't open the pull request itself, it falls back to the compare URL from `git push`: https://cli.github.com");
  } else {
    const auth = sh("gh auth status");
    if (!auth.ok) hints.push("- `gh` is not authenticated – no pull requests from here: `gh auth login` (needs the `repo` scope)");
    else if (!/Token scopes:.*'repo'/.test(auth.out)) hints.push("- The `gh` token has no `repo` scope – creating pull requests will fail: `gh auth refresh -s repo`");
  }

  if (vercelMcpApproved() === false)
    hints.push(
      "- Vercel MCP (`vercel` in .mcp.json) is not enabled yet: approve the project server, then `/mcp` to authenticate. " +
        "It gives preview deployment status and build/runtime logs for the acceptance step; without it, ask the user for the preview URL.",
    );

  if (!existsSync(join(root, ".env.development.local")))
    hints.push("- No .env.development.local – `npm run dev` and `npm run db:migrate:dev` have no DATABASE_URL: see .env.example (local database: `npm run db:up`)");

  return hints;
}

const lines: string[] = [];

try {
  const hints = setupHints();
  if (hints.length > 0) lines.push("La Guardia – setup (tell the user, don't fix it silently):", ...hints, "");
} catch {
  // a broken check never blocks a session start
}

try {
  const { rel, storyId } = await import("../lib/discovery.ts");
  const { git, nextStory, readVerifyState } = await import("../lib/engineering.ts");

  lines.push("La Guardia – engineering status:");
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  const dirty = (git("status", "--porcelain") ?? "") !== "";
  lines.push(`- Branch: ${branch ?? "?"}${dirty ? " (uncommitted changes)" : ""}`);

  const { inProgress, next } = nextStory();
  for (const s of inProgress) lines.push(`- In progress: ${storyId(s)} – ${s.meta.title} (${rel(s.path)})`);
  if (next) lines.push(`- Next ready story: ${storyId(next)} – ${next.meta.title} (start with /implement)`);

  const v = readVerifyState();
  if (v) {
    const head = git("rev-parse", "--short", "HEAD");
    const stale = v.commit !== head || v.dirty ? " – older than the current code" : "";
    const failed = v.steps.filter((s) => !s.ok).map((s) => s.name);
    lines.push(`- Last verify: ${v.ok ? "green" : `RED (${failed.join(", ")})`} at ${v.at} on ${v.branch}@${v.commit}${stale}`);
  }
} catch {
  // never block a session start
}

if (lines.length > 0) console.log(lines.join("\n"));
process.exit(0);
