/**
 * A file is at most 100 MB, any format (`docs/stories/OPEN_QUESTIONS.md`, ST-037; confirmed by ST-001). Counted in
 * binary megabytes, so a file a phone shows as "100 MB" passes.
 */
export const FILE_SIZE_LIMIT = 100 * 1024 * 1024;

/** The fixed age after which a pending upload nobody attached is abandoned and cleaned up (ADR 0009). */
export const ABANDONED_AFTER_HOURS = 24;

/**
 * The time at and before which a pending upload is abandoned. Attaching takes only younger ones, the cleanup only
 * these – one boundary for both, so a pending upload is attached or cleaned up, never both (ADR 0009).
 */
export function abandonedUntil(now: Date): Date {
  return new Date(now.getTime() - ABANDONED_AFTER_HOURS * 60 * 60 * 1000);
}

/** How the server names uploaded content: `files/<ID from the injected generator>`. */
export function contentName(id: string): string {
  return `files/${id}`;
}

/**
 * Whether a name is one the server gives to the content of a file: uploaded content, or a camera photo the photo module
 * stored as a file (`files/<ID>.jpg`, ST-054).
 */
export function isContentName(name: string): boolean {
  return /^files\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.jpg)?$/.test(name);
}
