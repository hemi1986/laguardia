import {
  aiDependencies,
  aiIndexStatesForOverview,
  filesContainingWords,
  type AiDependencies,
} from "@/modules/ai-assistance";
import {
  fileOverview,
  fileOverviewChoices,
  fileRemovedBy,
  type FileOverviewChoices,
  type FileOverviewEntry,
  type FileOverviewFilter,
} from "@/modules/collection";
import type { Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { fileDetailsAddress } from "./file-navigation";
import { fileSizeText } from "./[fileId]/details/file-size";
import { targetOf, targetValue } from "./[fileId]/details/file-attachments";
import {
  FILES_PER_PAGE,
  fileOverviewAddress,
  fileOverviewQueryOf,
  type FileOverviewQuery,
} from "./file-overview-query";
import { searched } from "./search-order";
import { searchWordsOf } from "./search-words";

const { fileOverview: texts, fileDetails, aiIndex } = teamMessages;

/** One entry of the list (G18, G5): its title leads to the file details, below it what the file is. */
export type FileOverviewItem = { id: string; title: string; href: string; line: string };

/** One option of a choice: the value the form sends and the words the person reads. */
export type Option = { value: string; label: string };

export type FileOverviewData = {
  /** What the address held that this page understands – the filters and the (checked) page. */
  query: FileOverviewQuery;
  count: string;
  entries: FileOverviewItem[];
  /** No file exists at all (G7) – the page says what to do instead of listing and filtering. */
  empty: boolean;
  /** Files exist, but none passes the filters (G7). */
  nothingFound: boolean;
  fileCategories: Option[];
  /** „Geräte“ and „Modelle“, after the two options that name no machine. */
  machines: Option[];
  machineModels: Option[];
  /** „KI-Erfassung“ – none while AI is off (G37). */
  aiIndexStates: Option[] | undefined;
  /** „Zurück“ and „Weiter“ (G40), each only when there is a page to go to. */
  previous: string | undefined;
  next: string | undefined;
  /** The confirmation after a removal that landed here (G3): the file's title, from the journal. */
  removedTitle: string | undefined;
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
 * The file overview's data (RM-FileOverview, ST-117, context map steps 1, 3 and 5): Collection's files that pass the filters,
 * newest first, with AI assistance's index state – for the 25 shown, or for all that remain when the state filter is set –,
 * cut into the page the address names (G40). The page composes (ST-009). While AI is off the state and its filter are
 * absent, and a state in the address is ignored (G37).
 */
export async function loadFileOverview(
  db: Database,
  {
    params,
    viewer,
    ai = aiDependencies(),
  }: {
    params: Record<string, string | string[] | undefined>;
    viewer: { id: string };
    ai?: Pick<AiDependencies, "encryptionKey">;
  },
): Promise<FileOverviewData> {
  const asked = fileOverviewQueryOf(params);
  const [choices, removed] = await Promise.all([
    fileOverviewChoices(db),
    typeof params.fileRemoved === "string" ? fileRemovedBy(db, params.fileRemoved, viewer.id) : undefined,
  ]);
  const filter = filterOf(asked, choices);
  // The search (ST-118): Collection's files with how well their own text matches each word, AI assistance's files with the
  // words in a passage; the page merges them by file ID. Without words the list is as it was.
  const words = asked.search ? searchWordsOf(asked.search) : [];
  const found =
    words.length > 0
      ? searched(await fileOverview(db, filter, words), await filesContainingWords(db, words))
      : await fileOverview(db, filter);

  // The AI index state: for every file that remains when it narrows the list, else for the page's files only.
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

  const query: FileOverviewQuery = {
    ...(asked.search && { search: asked.search }),
    ...(asked.fileCategory && { fileCategory: asked.fileCategory }),
    ...(filter.attachedTo && { attachedTo: asked.attachedTo }),
    ...(aiIndexFilter && { aiIndex: aiIndexFilter }),
    ...(page > 1 && { page }),
  };
  const filtered = Object.keys(query).some((key) => key !== "page");
  // Files exist, or not at all: the answer to an address with filters needs the files without them.
  const empty = remaining.length === 0 && (!filtered || (await fileOverview(db, {})).length === 0);

  return {
    query,
    count: texts.count(remaining.length, page, pages),
    entries: shown.map((entry) => ({
      id: entry.id,
      title: entry.title,
      href: fileDetailsAddress(entry.id, { files: query }),
      line: lineOf(entry, stateOf?.(entry.id)),
    })),
    empty,
    nothingFound: remaining.length === 0 && !empty,
    fileCategories: Object.entries(teamMessages.fileCategories).map(([value, label]) => ({ value, label })),
    machines: choices.machines.map((machine) => ({
      value: targetValue({ machineId: machine.id }),
      label: machine.retired
        ? fileDetails.retiredMachine(machine.museumNumber)
        : fileDetails.machine(machine.museumNumber, machine.machineModelTitle),
    })),
    machineModels: choices.machineModels.map((model) => ({
      value: targetValue({ machineModelId: model.id }),
      label: model.title,
    })),
    aiIndexStates: aiOn
      ? [
          { value: "indexed", label: aiIndex.fileState.indexed },
          { value: "waiting", label: aiIndex.fileState.waiting },
          { value: "failed", label: aiIndex.unreadable },
        ]
      : undefined,
    previous: page > 1 ? fileOverviewAddress({ ...query, page: page - 1 }) : undefined,
    next: page < pages ? fileOverviewAddress({ ...query, page: page + 1 }) : undefined,
    removedTitle: removed?.title,
  };
}

/** „Handbuch · PDF · 12,4 MB · Für die KI erfasst“ (G13, G37): the state only while AI is on; the reason is the details'. */
function lineOf(entry: FileOverviewEntry, state: "indexed" | "waiting" | "failed" | undefined): string {
  const head = fileDetails.head(
    teamMessages.fileCategories[entry.fileCategory],
    fileDetails.mediaTypes[entry.mediaType],
    fileSizeText(entry.size),
  );
  if (!state) return head;
  return `${head} · ${state === "failed" ? aiIndex.unreadable : aiIndex.fileState[state]}`;
}
