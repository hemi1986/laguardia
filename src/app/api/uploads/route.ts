import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { loggedInTeamMember } from "@/modules/team";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { blobStorage } from "@/platform/storage";
import { uploadRoute } from "./upload-route";

/** Upload addresses for direct uploads from the browser to the private Blob store (ST-085, ADR 0009). */
export async function POST(request: Request): Promise<Response> {
  const db = database();
  return uploadRoute({
    db,
    storage: blobStorage(),
    clock: systemClock,
    newId: randomUUID,
    teamMember: (headers) => loggedInTeamMember({ db, headers, inNext: true }),
    afterResponse: (work) => after(work),
  })(request);
}
