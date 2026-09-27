import "server-only";
import { randomUUID } from "node:crypto";
import { issueSignedToken, presignUrl, put } from "@vercel/blob";
import type { AcceptedPhoto } from "./accept-photo";

/**
 * Stores an accepted photo in the private Blob store under an unguessable name; returns its pathname.
 * The caller decides who may do this (authorization in the command, never here).
 */
export async function storePhoto(photo: AcceptedPhoto, prefix: string): Promise<string> {
  const { pathname } = await put(`${prefix}/${randomUUID()}.jpg`, photo.bytes, {
    access: "private",
    contentType: photo.contentType,
    addRandomSuffix: false,
  });
  return pathname;
}

/** Short-lived (5 minutes) addresses for showing stored photos – only issued after the caller's access check. */
export async function photoAddresses(pathnames: string[]): Promise<Map<string, string>> {
  const addresses = new Map<string, string>();
  if (!pathnames.length) return addresses;
  const validUntil = Date.now() + 5 * 60 * 1000;
  const token = await issueSignedToken({ pathname: "*", operations: ["get"], validUntil });
  for (const pathname of pathnames) {
    const { presignedUrl } = await presignUrl(token, { operation: "get", pathname, access: "private", validUntil });
    addresses.set(pathname, presignedUrl);
  }
  return addresses;
}
