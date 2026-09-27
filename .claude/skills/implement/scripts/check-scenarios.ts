/**
 * Traceability between acceptance criteria and tests.
 * Every scenario of a story that is in progress or done needs a test titled exactly `ST-NNN: <scenario title>`.
 *
 *   ERROR  a done story with a scenario without a test
 *   ERROR  a test title `ST-NNN: …` that matches no scenario (renamed scenario, typo, unknown story)
 *   INFO   scenarios still missing for stories in progress
 *
 * Usage: node check-scenarios.ts [ST-NNN]   (with an ID: only that story, missing tests are listed)
 */
import * as d from "../../../lib/discovery.ts";
import * as e from "../../../lib/engineering.ts";

const only = process.argv[2]?.toUpperCase();
const stories = e.storiesById();
const titles = e.testTitles();
const report = new d.Report();
const info: string[] = [];

for (const [id, s] of stories) {
  if (only ? id !== only : !["in-progress", "done"].includes(s.meta.status) || s.meta.type !== "story") continue;
  const { covered, missing } = e.scenarioCoverage(s, titles);
  for (const sc of missing) {
    if (s.meta.status === "done") report.error(id, `scenario without test: "${e.testTitle(id, sc)}"`);
    else info.push(`${id}: missing test "${e.testTitle(id, sc)}"`);
  }
  info.push(`${id}: ${covered.length}/${covered.length + missing.length} scenarios covered`);
}

const known = new Set<string>();
for (const [id, s] of stories) for (const sc of e.scenarioTitles(s)) known.add(e.testTitle(id, sc).replace(/\s+/g, " "));
for (const t of titles) {
  if (only && !t.title.startsWith(`${only}:`)) continue;
  if (!known.has(t.title)) report.error(t.file, `test title "${t.title}" matches no scenario of any story`);
}

for (const line of info) console.log(`INFO     ${line}`);
for (const line of report.lines()) console.log(line);
console.log(report.ok ? "Scenario traceability OK." : `${report.errors.length} error(s).`);
process.exit(report.ok ? 0 : 1);
