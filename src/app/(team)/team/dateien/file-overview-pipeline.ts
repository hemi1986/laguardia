import {
  aiIndexStatesForOverview,
  filesContainingWords,
  type AiDependencies,
  type AiIndexStateOfFile,
} from "@/modules/ai-assistance";
import {
  fileOverview,
  type FileOverviewChoices,
  type FileOverviewEntry,
  type FileOverviewFilter,
} from "@/modules/collection";
import type { Database } from "@/platform/command";
import { targetOf } from "./[fileId]/details/file-attachments";
import { FILES_PER_PAGE, type FileOverviewQuery } from "./file-overview-query";
import { searched } from "./search-order";
import { searchWordsOf } from "./search-words";

/** What AI assistance says of a file's index (RM-FileOverview, G37). */
export type AiIndexState = AiIndexStateOfFile["state"];

/** What the pipeline made of the address: the files that remain, the page of them and what was in effect. */
export type FileOverviewPage = {
  /** The filter Collection was asked, an unknown machine or machine model left out. */
  filter: FileOverviewFilter;
  /** The state filter in effect – none while AI is off, whatever the address says (G37). */
  aiIndexFilter: AiIndexState | undefined;
  /** Every file that passes all filters and the search, in the order to show. */
  remaining: FileOverviewEntry[];
  /** The page number in effect (G40) and how many pages there are. */
  page: number;
  pages: number;
  /** The files of that page. */
  shown: FileOverviewEntry[];
  /** The AI index state of a shown file – none while AI is off. */
  stateOf: ((fileId: string) => AiIndexState | undefined) | undefined;
};

/** What the filters narrow Collection's query to – a machine or machine model only when it exists. */
function filterOf(query: FileOverviewQuery, choices: FileOverviewChoices): FileOverviewFilter {
  const target = query.attachedTo === "nowhere" ? ("nowhere" as const) : targetOf(query.attachedTo);
  const known =
    target === "nowhere" ||
    (target &&
      ("machineId" in target
        ? choices.machines.some((machine) => machine.id === target.machineId)
        : choices.machineModels.some((model) => model.id === target.machineModelId)));
  return { fileCategory: query.fileCategory, attachedTo: known ? target : undefined };
}

/**
 * The file overview's pipeline (RM-FileOverview, ST-117, ST-118, context map steps 1 to 5), above Collection and AI
 * assistance, which know nothing of each other: **filter** (Collection's files that pass the filters, newest first) →
 * **search** (Collection's per-word ranks of a file's own text, AI assistance's files with the words in a passage) →
 * **merge** by file ID (`searched`) → **AI index state** (for every file that remains when the state narrows the list, else
 * for the page's files only; none while AI is off, and a state in the address is ignored, G37) → **page** (G40: a page
 * past the end is the last). The page's data (`loadFileOverview`) shapes the result into what is shown.
 */
export async function fileOverviewPage(
  db: Database,
  {
    asked,
    choices,
    ai,
  }: { asked: FileOverviewQuery; choices: FileOverviewChoices; ai: Pick<AiDependencies, "encryptionKey"> },
): Promise<FileOverviewPage> {
  const filter = filterOf(asked, choices);
  // Without words the list is as it was.
  const words = asked.search ? searchWordsOf(asked.search) : [];
  const found =
    words.length > 0
      ? searched(await fileOverview(db, filter, words), await filesContainingWords(db, words))
      : await fileOverview(db, filter);

  const stateOfAll = await aiIndexStatesForOverview(db, ai, asked.aiIndex ? found.map((entry) => entry.id) : []);
  const aiOn = stateOfAll !== undefined;
  const aiIndexFilter = aiOn ? asked.aiIndex : undefined;
  const remaining =
    stateOfAll && aiIndexFilter ? found.filter((entry) => stateOfAll(entry.id) === aiIndexFilter) : found;

  const pages = Math.max(1, Math.ceil(remaining.length / FILES_PER_PAGE));
  const page = Math.min(asked.page ?? 1, pages);
  const shown = remaining.slice((page - 1) * FILES_PER_PAGE, page * FILES_PER_PAGE);
  const stateOf = !aiOn
    ? undefined
    : aiIndexFilter
      ? stateOfAll
      : await aiIndexStatesForOverview(
          db,
          ai,
          shown.map((entry) => entry.id),
        );
  return { filter, aiIndexFilter, remaining, page, pages, shown, stateOf };
}
