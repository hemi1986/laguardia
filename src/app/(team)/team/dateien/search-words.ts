/** How many words of a search count, and how long one may be – a longer search is cut, not refused. */
const MAX_WORDS = 8;
const MAX_WORD_LENGTH = 40;
/** How much of the typed search the address keeps. */
export const MAX_SEARCH_LENGTH = 200;

/**
 * The words of a search (ST-118): punctuation separates them (`LG-042` is „lg“ and „042“, `medieval_manual-v2.pdf` is
 * four), upper and lower case are one, and a word typed twice counts once. Nothing but punctuation is no search: the
 * list stays as it is. The same words go to Collection's and to AI assistance's query (context map).
 */
export function searchWordsOf(search: string): string[] {
  const words = search
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0)
    .map((word) => word.slice(0, MAX_WORD_LENGTH));
  return [...new Set(words)].slice(0, MAX_WORDS);
}
