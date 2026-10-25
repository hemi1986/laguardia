import type { ContentStorage } from ".";

/**
 * Deletes content a command removed on purpose – a spam dismissal's photo (ST-020), a removed file's content (ST-038),
 * ADR 0009 – after that command was committed, so the removal stands whatever happens here. A failed delete is logged
 * by the content's stored name only, never with the content or anyone's text, so it can be deleted by hand later; the
 * person still gets their answer.
 */
export async function deleteRemovedContent(storage: ContentStorage, name: string): Promise<void> {
  try {
    await storage.delete(name);
  } catch (error) {
    console.error(`content not deleted, delete it by hand: ${name}:`, error instanceof Error ? error.message : error);
  }
}
