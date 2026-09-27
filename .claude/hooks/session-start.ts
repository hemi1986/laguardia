/**
 * SessionStart hook: tells Claude where the engineering work stands –
 * branch, stories in progress, the next story, and the last verify result.
 */
import { rel } from "../lib/discovery.ts";
import { git, nextStory, readVerifyState } from "../lib/engineering.ts";
import { storyId } from "../lib/discovery.ts";

try {
  const lines: string[] = ["La Guardia – engineering status:"];
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
  console.log(lines.join("\n"));
} catch {
  // never block a session start
}
process.exit(0);
