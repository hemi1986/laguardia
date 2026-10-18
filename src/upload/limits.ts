/**
 * A file is at most 100 MB, any format (`docs/stories/OPEN_QUESTIONS.md`, ST-037; confirmed by ST-001). Counted in
 * binary megabytes, so a file a phone shows as "100 MB" passes.
 */
export const FILE_SIZE_LIMIT = 100 * 1024 * 1024;
