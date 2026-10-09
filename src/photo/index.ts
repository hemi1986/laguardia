/**
 * Public interface of the photo module (ST-016) – the server half. Other code imports only this file (and the browser
 * half, `./browser.ts`, from client components). How photos are taken, checked and stored: `docs/architecture/photos.md`.
 */
export { PHOTO_LIMITS } from "./limits";
export {
  photoErrors,
  photoViewAddresses,
  removePhoto,
  withStoredPhoto,
  type PhotoDependencies,
  type PhotoError,
  type PhotoOwner,
  type PhotoReference,
} from "./store-photo";
