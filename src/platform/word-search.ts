import { sql, type SQL } from "drizzle-orm";

/**
 * Searching words in PostgreSQL, the one place (ST-118, ADR 0018, architecture review 2026-11-06): what a text's words
 * are, and what a searched word asks. German and English stems are kept together ("Spule" finds "Spulen", "coil"
 * finds "coils"); punctuation and spaces separate words (`medieval_manual-v2` is three). A stored text and a searched
 * text must be made the same way – a change here changes both, and a stored column needs its migration.
 */

/** The words of a text, as a `tsvector`: what a passage stores and what a file's own text is searched in. */
export const wordsOfText = (text: SQL) =>
  sql`(to_tsvector('german'::regconfig, regexp_replace(coalesce(${text}, ''), '[[:punct:][:space:]]+', ' ', 'g')) || to_tsvector('english'::regconfig, regexp_replace(coalesce(${text}, ''), '[[:punct:][:space:]]+', ' ', 'g')))`;

/**
 * What a searched word asks, as a `tsquery`. A word that is a stop word in both languages (`in`, `am`) has an empty
 * query (`numnode(query) = 0`), which matches nothing.
 */
export const queryOfWord = (word: string) =>
  sql`(plainto_tsquery('german'::regconfig, ${word}) || plainto_tsquery('english'::regconfig, ${word}))`;
