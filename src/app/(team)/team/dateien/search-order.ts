import type { FileOverviewEntry } from "@/modules/collection";
import type { FilesContainingWords } from "@/modules/ai-assistance";

/**
 * What a search finds and in which order (ST-118, context map steps 3 and 4). A file matches when **every word** is found
 * in at least one of the two places – its own text (Collection) or the passages of its content (AI assistance) –, not
 * all in the same one. Best match first: by how many of the words its own text holds, then the rank of that, then the
 * rank of the content; files that tie keep the order they came in (newest first). The two ranks are never added up –
 * they measure different texts – so a word in a title or a name beats the same word on page 340.
 */
export function searched(entries: FileOverviewEntry[], content: FilesContainingWords): FileOverviewEntry[] {
  const found = entries.flatMap((entry, position) => {
    const contentRanks = content.map((files) => files.get(entry.id));
    if (!entry.ownRanks.every((own, word) => own !== null || contentRanks[word] !== undefined)) return [];
    const own = entry.ownRanks.filter((rank): rank is number => rank !== null);
    const sum = (ranks: readonly number[]) => ranks.reduce((total, rank) => total + rank, 0);
    return [
      {
        entry,
        position,
        ownCount: own.length,
        ownRank: sum(own),
        contentRank: sum(contentRanks.filter((rank): rank is number => rank !== undefined)),
      },
    ];
  });
  return found
    .sort(
      (a, b) =>
        b.ownCount - a.ownCount || b.ownRank - a.ownRank || b.contentRank - a.contentRank || a.position - b.position,
    )
    .map(({ entry }) => entry);
}
