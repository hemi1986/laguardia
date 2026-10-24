"use server";

import { recordVisit } from "@/modules/team";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { currentPerson } from "../../_actions/current-person";

/**
 * Records that the team member of this request opened their dashboard (ST-050, ADR 0011) – called only by the
 * dashboard's client effect. It takes no input: whose visit it is comes from the session alone, never from the browser;
 * without a team member's session it records nothing.
 */
export async function recordVisitAction(): Promise<void> {
  const person = await currentPerson();
  if (person.kind !== "team-member") return;
  await recordVisit(database(), systemClock, person.teamMemberId);
}
