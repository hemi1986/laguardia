import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { loggedInTeamMember } from "@/modules/team";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { s3Storage } from "@/platform/storage";
import { uploadRoute } from "./upload-route";

/** Upload addresses for direct uploads from the browser to the private bucket (ST-085, ST-099, ADR 0009/0012). */
export async function POST(request: Request): Promise<Response> {
  const db = database();
  return uploadRoute({
    db,
    storage: s3Storage(),
    clock: systemClock,
    newId: randomUUID,
    teamMember: (headers) => loggedInTeamMember({ db, headers, inNext: true }),
    afterResponse: (work) => after(work),
  })(request);
}
