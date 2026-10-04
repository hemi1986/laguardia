import "server-only";
import type { Clock } from "@/platform/clock";
import type { CommandResult } from "@/platform/command";
import type { ContentStorage } from "@/platform/storage";
import { acceptPhoto } from "./accept-photo";

/** Every way a photo can fail – defined once here (ST-016), each with a text in the team and visitor catalogs. */
export const photoErrors = ["too-large", "not-an-image", "unsupported-format", "not-stored"] as const;
export type PhotoError = (typeof photoErrors)[number];

/** Who a photo belongs to – the first part of its stored name. */
export type PhotoOwner = "problem-reports";

/** The reference a command keeps for a stored photo: its name in the storage seam. */
export type PhotoReference = string;

export type PhotoDependencies = { storage: ContentStorage; newId: () => string };

/** How long an address for showing a photo is valid (ST-002). */
const VIEW_MINUTES = 5;

/**
 * The one way to store a photo (ST-016, architecture review Q7/Q17, ADR 0007): accept the sent photo (size, real image,
 * re-encoded without metadata), store it under a name from the injected ID generator, run the command with its
 * reference – and delete the photo again if the command is rejected or throws. Without a sent photo the command runs
 * without a photo. Authorization stays in the command: a `not-authorized` command leaves nothing behind either.
 */
export async function withStoredPhoto<Result, Error extends string>(
  sentPhoto: Uint8Array | undefined,
  owner: PhotoOwner,
  { storage, newId }: PhotoDependencies,
  run: (photo: PhotoReference | undefined) => Promise<CommandResult<Result, Error>>,
): Promise<CommandResult<Result, Error> | { ok: false; error: PhotoError }> {
  if (!sentPhoto) return run(undefined);

  const accepted = await acceptPhoto(sentPhoto);
  if (!accepted.ok) return accepted;

  const name = `${owner}/${newId()}.jpg`;
  try {
    await storage.write(name, accepted.photo.bytes, accepted.photo.contentType);
  } catch (error) {
    // Visible in the function logs (a Blob outage); the photo itself and the person stay out of the log.
    console.error("photo not stored:", error instanceof Error ? error.message : error);
    return { ok: false, error: "not-stored" };
  }

  let outcome: CommandResult<Result, Error>;
  try {
    outcome = await run(name);
  } catch (error) {
    await deleteQuietly(storage, name);
    throw error;
  }
  if (!outcome.ok) await deleteQuietly(storage, name);
  return outcome;
}

/**
 * Deletes the photo of a failed command. If that fails too, the person still gets the command's answer: the photo stays
 * behind unreferenced in the private store – the same leftover as after a crash (ADR 0007, Consequences).
 */
async function deleteQuietly(storage: ContentStorage, name: PhotoReference): Promise<void> {
  try {
    await storage.delete(name);
  } catch {
    // unreferenced and unreachable without a signed address – accepted (ADR 0007)
  }
}

/**
 * Addresses for showing stored photos, valid for 5 minutes from the injected clock's time – only issued after the
 * page's access check (team members only, HS-1). When the storage cannot issue them, there are none: the page still
 * shows its problem reports, without photos.
 */
export async function photoViewAddresses(
  storage: ContentStorage,
  clock: Clock,
  photos: readonly PhotoReference[],
): Promise<Map<PhotoReference, string>> {
  const validUntil = new Date(clock.now().getTime() + VIEW_MINUTES * 60 * 1000);
  try {
    return await storage.viewAddresses(photos, validUntil);
  } catch {
    return new Map();
  }
}
