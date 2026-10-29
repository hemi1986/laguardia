import "server-only";
import { cookies } from "next/headers";
import { DESIGN_COOKIE, designOf, deviceDesign, type Design } from "./design";

/** The device's choice of this request, from its cookie (ST-090) – the one place the cookie is read. */
export async function currentDeviceDesign(): Promise<Design | undefined> {
  return deviceDesign((await cookies()).get(DESIGN_COOKIE)?.value);
}

/** The design of a team page on this device – what the switch under „Mehr“ switches away from. */
export async function currentTeamDesign(): Promise<Design> {
  return designOf("/team", await currentDeviceDesign());
}
