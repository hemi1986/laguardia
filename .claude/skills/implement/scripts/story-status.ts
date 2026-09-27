/**
 * Moves a story to a new status, enforcing the workflow and its preconditions:
 *   in-progress / done – all depends_on are done
 *   done (story)       – every Gherkin scenario has a test titled `ST-NNN: <scenario title>`
 *   done (spike/task)  – every acceptance criterion is ticked (`- [x]`)
 *   done is final      – changes become a new story
 *
 * Usage: node story-status.ts ST-010 in-progress|done|review
 */
import * as d from "../../../lib/discovery.ts";
import * as e from "../../../lib/engineering.ts";

const [id, to] = process.argv.slice(2);
if (!id || !to || !(d.STATUSES as readonly string[]).includes(to)) {
  console.error(`Usage: node story-status.ts ST-NNN <${d.STATUSES.join("|")}>`);
  process.exit(1);
}
const stories = e.storiesById();
const story = stories.get(id.toUpperCase());
if (!story) {
  console.error(`Story '${id}' not found in docs/stories/.`);
  process.exit(1);
}
const from = String(story.meta.status);
const errs = e.transitionErrors(story, from, to, stories);
if (errs.length) {
  console.error(`${d.storyId(story)} cannot go from '${from}' to '${to}':\n${errs.map((x) => `  - ${x}`).join("\n")}`);
  process.exit(1);
}
e.writeStatus(story, to);

const report = new d.Report();
d.validateStories(report, story.path, true);
if (!report.ok) {
  e.writeStatus(story, from);
  console.error(`Validation failed, status left at '${from}':\n${report.lines().join("\n")}`);
  process.exit(1);
}
d.writeBacklogMd();
console.log(`${d.storyId(story)}: ${from} → ${to}`);
