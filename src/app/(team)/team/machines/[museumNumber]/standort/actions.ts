"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { moveMachineCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { requireTeamMember } from "../../../../../team-session";
import { moveMachineFields, moveMachineInput } from "./move-machine-input";

/**
 * CMD-MoveMachine from the move page (ST-034) – through the Server Action runner (ST-073). After the move the team
 * member is back on the machine record, which names the machine and its new location (G3).
 */
const moveMachine = formAction(moveMachineCommand, {
  fields: moveMachineFields,
  input: moveMachineInput,
  onSuccess: async ({ museumNumber }) => {
    const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
    revalidatePath("/team/machines");
    revalidatePath(record);
    redirect(`${record}?moved=1`);
  },
});

export type MoveMachineState = Parameters<typeof moveMachine>[0];

export async function moveMachineAction(previous: MoveMachineState, formData: FormData): Promise<MoveMachineState> {
  await requireTeamMember(); // the page's access check; every team member may move a machine (HS-18)
  return moveMachine(previous, formData);
}
