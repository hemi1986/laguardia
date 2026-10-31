import { connection } from "next/server";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { s3Storage } from "@/platform/storage";
import { logoRoute } from "./logo-route";

/** The museum's logo for visitors (ST-102) – see `logoRoute`. Answered per request, never prerendered. */
export async function GET() {
  await connection();
  return logoRoute({ db: database(), storage: s3Storage(), clock: systemClock })();
}
