/**
 * The one quality gate – used by /implement, the CI pipeline (`npm run verify` in the app, ST-059) and developers.
 *
 *   1. App checks from the root package.json, if the scripts exist: lint (incl. module boundary rules), typecheck, test
 *      (with --e2e also test:e2e)
 *   2. Discovery artifacts: events.yaml and stories are valid
 *   3. Traceability: scenario ↔ test titles, domain IDs in the code
 *   4. Glossary language (warnings only)
 *
 * Writes the result to .claude/state/last-verify.json (shown at session start). Exit 1 if any step failed.
 *
 * Usage: node verify.ts [--e2e]
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import * as d from "../../../lib/discovery.ts";
import * as e from "../../../lib/engineering.ts";

const here = import.meta.dirname;
const steps: e.VerifyState["steps"] = [];

function run(name: string, cmd: string, args: string[], advisory = false): void {
  console.log(`\n━━ ${name} ━━`);
  const r = spawnSync(cmd, args, { cwd: d.ROOT, stdio: "inherit" });
  const ok = r.status === 0;
  steps.push({ name, ok: ok || advisory });
  if (!ok && !advisory) console.log(`✗ ${name} failed`);
}

const scripts = e.appScripts();
const appSteps = ["lint", "typecheck", "test", ...(process.argv.includes("--e2e") ? ["test:e2e"] : [])];
if (!Object.keys(scripts).length) {
  console.log("━━ app ━━\nNo root package.json with scripts yet (created by ST-001) – app checks skipped.");
}
for (const s of appSteps) {
  if (scripts[s]) run(`npm run ${s}`, "npm", ["run", s]);
  else if (Object.keys(scripts).length) {
    console.log(`\n━━ npm run ${s} ━━\nno '${s}' script in package.json – skipped`);
    steps.push({ name: `npm run ${s}`, ok: true, skipped: true });
  }
}

const node = process.execPath;
const disc = join(here, "..", "..");
run("events.yaml", node, [join(disc, "event-storming", "scripts", "validate-events.ts")]);
run("stories", node, [join(disc, "user-stories", "scripts", "validate-stories.ts")]);
run("scenario ↔ test traceability", node, [join(here, "check-scenarios.ts")]);
run("domain ID traceability", node, [join(here, "check-commands.ts")]);
run("glossary language", node, [join(here, "check-language.ts")], true);

const ok = steps.every((s) => s.ok);
e.writeVerifyState({
  at: new Date().toISOString(),
  branch: e.git("rev-parse", "--abbrev-ref", "HEAD"),
  commit: e.git("rev-parse", "--short", "HEAD"),
  dirty: (e.git("status", "--porcelain") ?? "") !== "",
  ok,
  steps,
});
console.log(`\n${ok ? "✓ verify passed" : "✗ verify FAILED: " + steps.filter((s) => !s.ok).map((s) => s.name).join(", ")}`);
process.exit(ok ? 0 : 1);
