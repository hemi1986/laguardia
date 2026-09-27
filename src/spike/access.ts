import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Throwaway gate of the ST-001 spike: stands in for "a logged-in team member" until team login exists (ST-004).
 * Closed when SPIKE_PASSWORD is not set. Checked in every page, action and route that needs it – never in a proxy.
 */
const COOKIE = "spike-access";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export async function hasSpikeAccess(): Promise<boolean> {
  const password = process.env.SPIKE_PASSWORD;
  const cookie = (await cookies()).get(COOKIE)?.value;
  if (!password || !cookie) return false;
  return timingSafeEqual(digest(cookie), digest(digest(password).toString("hex")));
}

export async function grantSpikeAccess(password: string): Promise<boolean> {
  const expected = process.env.SPIKE_PASSWORD;
  if (!expected || !timingSafeEqual(digest(password), digest(expected))) return false;
  (await cookies()).set(COOKIE, digest(expected).toString("hex"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
  });
  return true;
}
