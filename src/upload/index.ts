/**
 * Public interface of the upload module (ST-085, ADR 0009) – the server half. Content uploaded from the browser
 * straight to the store: the upload address, attaching what was uploaded, and the cleanup of abandoned uploads. The
 * browser half is `./browser.ts`.
 */
export { FILE_SIZE_LIMIT } from "./limits";
export {
  issueUploadAddress,
  type UploadDependencies,
  type UploadOwner,
  type UploadRequest,
} from "./pending-uploads";
export {
  uploadedContentErrors,
  withUploadedContent,
  type UploadedContent,
  type UploadedContentError,
} from "./uploaded-content";
export { cleanUpAbandonedUploads } from "./abandoned-uploads";
export { viewAddressOf } from "./view-address";
