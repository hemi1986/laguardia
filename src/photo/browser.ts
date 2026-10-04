/**
 * Public interface of the photo module – the browser half (ST-016): client components prepare a photo here before it
 * is sent (upright, ≤ 2048 px, JPEG ≤ 1 MB, no metadata). The server half is `./index.ts`.
 */
export { PhotoNotReadableError, PhotoTooLargeError, preparePhoto } from "./prepare-photo";
export { PHOTO_LIMITS } from "./limits";
