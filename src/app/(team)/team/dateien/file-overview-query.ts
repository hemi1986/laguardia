import { fileCategories, type FileCategory } from "@/modules/collection";
import { targetOf } from "./[fileId]/details/file-attachments";
import { MAX_SEARCH_LENGTH, searchWordsOf } from "./search-words";

/** Where the file overview shows 25 files at a time (G40). */
export const FILES_PER_PAGE = 25;

/** The states the filter „KI-Erfassung“ offers, in the order it offers them (the states of the AI index, G37). */
export const aiIndexFilters = ["indexed", "waiting", "failed"] as const;
export type AiIndexFilter = (typeof aiIndexFilters)[number];

/**
 * What the address of „Dateien“ holds (G40, G32): the filters and the page – nothing else. `attachedTo` is `nowhere`,
 * `machine:<id>` or `machineModel:<id>`, the one wording of an attachment target in an address (`targetValue`).
 */
export type FileOverviewQuery = {
  /** What was typed into „Suche“ (ST-118) – only a search that has words; one of punctuation only is no search. */
  search?: string;
  fileCategory?: FileCategory;
  attachedTo?: string;
  aiIndex?: AiIndexFilter;
  /** From 2; page 1 is the absence of a page. */
  page?: number;
};

/** The parameters the overview's address knows – the closed list the file details' origin is checked against (G17). */
const KNOWN = ["search", "fileCategory", "attachedTo", "aiIndex", "page"] as const;

type Params = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function searchOf(value: string | undefined): string | undefined {
  const search = value?.trim().slice(0, MAX_SEARCH_LENGTH).trim();
  return search && searchWordsOf(search).length > 0 ? search : undefined;
}

function fileCategoryOf(value: string | undefined): FileCategory | undefined {
  return fileCategories.find((category) => category === value);
}

function attachedToOf(value: string | undefined): string | undefined {
  if (value === "nowhere") return value;
  return targetOf(value) ? value : undefined;
}

function aiIndexOf(value: string | undefined): AiIndexFilter | undefined {
  return aiIndexFilters.find((state) => state === value);
}

function pageOf(value: string | undefined): number | undefined {
  if (!value || !/^[1-9][0-9]{0,6}$/.test(value)) return undefined;
  const page = Number(value);
  return page > 1 ? page : undefined;
}

/**
 * The query an address holds, leniently: a value that is not one of ours is left out, as if it had not been sent – a
 * bookmarked address from an older version, or a typed one, still opens the page.
 */
export function fileOverviewQueryOf(params: Params): FileOverviewQuery {
  return compact({
    search: searchOf(single(params.search)),
    fileCategory: fileCategoryOf(single(params.fileCategory)),
    attachedTo: attachedToOf(single(params.attachedTo)),
    aiIndex: aiIndexOf(single(params.aiIndex)),
    page: pageOf(single(params.page)),
  });
}

/**
 * The query a file details' origin carries, strictly (G17): anything that is not exactly one of ours – another
 * parameter, a foreign value, a value twice – is no known origin at all.
 */
export function strictFileOverviewQueryOf(search: URLSearchParams): FileOverviewQuery | undefined {
  const keys = [...search.keys()];
  if (keys.some((key) => !(KNOWN as readonly string[]).includes(key)) || new Set(keys).size !== keys.length) {
    return undefined;
  }
  const query = fileOverviewQueryOf(Object.fromEntries(search));
  // Re-serialised, it must say exactly what was sent (so `page=1` or `fileCategory=evil` are not known either).
  return queryString(query) === search.toString() ? query : undefined;
}

function compact(query: FileOverviewQuery): FileOverviewQuery {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined));
}

/** The query as an address holds it – always the same order, so the same query is the same string. */
export function queryString(query: FileOverviewQuery): string {
  const search = new URLSearchParams();
  if (query.search) search.set("search", query.search);
  if (query.fileCategory) search.set("fileCategory", query.fileCategory);
  if (query.attachedTo) search.set("attachedTo", query.attachedTo);
  if (query.aiIndex) search.set("aiIndex", query.aiIndex);
  if (query.page && query.page > 1) search.set("page", String(query.page));
  return search.toString();
}

/** The address of „Dateien“ for a query – the one place that builds it, for the buttons, the links and the way back. */
export function fileOverviewAddress(query: FileOverviewQuery = {}, extra: { fileRemoved?: string } = {}): string {
  const search = new URLSearchParams(queryString(query));
  if (extra.fileRemoved) search.set("fileRemoved", extra.fileRemoved);
  return `/team/dateien${search.size > 0 ? `?${search}` : ""}`;
}
