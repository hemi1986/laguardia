"use server";

import { systemClock } from "@/platform/clock";
import { blobStorage } from "@/platform/storage";
import { viewAddressOf } from "@/upload";
import { requireTechnician } from "../../../../../team-session";

/**
 * What the store holds for just-uploaded content (ST-085) – its size and an address to open it, valid for 5 minutes.
 * Technicians only, like the page.
 */
export async function storedContentAction(name: string): Promise<{ size?: number; viewAddress?: string }> {
  await requireTechnician();
  const storage = blobStorage();
  const viewAddress = await viewAddressOf(storage, systemClock, name);
  return viewAddress ? { size: await storage.size(name), viewAddress } : {};
}
