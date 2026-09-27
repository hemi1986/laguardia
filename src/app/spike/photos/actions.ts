"use server";

import { acceptPhoto } from "@/photo/accept-photo";
import { storePhoto } from "@/photo/store-photo";
import { hasSpikeAccess } from "@/spike/access";

export type UploadPhotoResult =
  | { ok: true; bytes: number; width: number; height: number; serverMs: number }
  | { ok: false; error: "not-authorized" | "missing" | "too-large" | "not-an-image" | "unsupported-format" };

/** ST-002 spike: the server half of the photo building block behind the stub login. */
export async function uploadPhoto(formData: FormData): Promise<UploadPhotoResult> {
  const started = Date.now();
  if (!(await hasSpikeAccess())) return { ok: false, error: "not-authorized" };
  const file = formData.get("photo");
  if (!(file instanceof File)) return { ok: false, error: "missing" };

  const result = await acceptPhoto(new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return result;
  await storePhoto(result.photo, "spike-photos");
  const { bytes, width, height } = result.photo;
  return { ok: true, bytes: bytes.byteLength, width, height, serverMs: Date.now() - started };
}
