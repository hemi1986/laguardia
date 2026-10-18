/**
 * Public interface of the upload module – the browser half (ST-085): client components upload a chosen file here,
 * straight to the private store, before the form that attaches it is sent. The server half is `./index.ts`.
 */
export { uploadFile, type UploadError } from "./upload-file";
export { FILE_SIZE_LIMIT } from "./limits";
export type { UploadOwner } from "./pending-uploads";
