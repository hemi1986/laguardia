"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { machineForTeamForm, retireReasonRefusal, retireRefusal } from "@/modules/collection";
import { retireMachineCommand, retirementConsequences } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../../team-session";
import {
  keptValues,
  retireMachineFields,
  retireMachineInput,
  retireStep,
  type RetireMachineField,
} from "./retire-machine-input";

type Values = { readonly [F in RetireMachineField]: string };

/**
 * The form's state: null before the first post; a rejection with what was typed; or the question – asked
 * (`asking: true`, with what it will close and dismiss) or gone back from (`asking: false`) – with the reason (G10b).
 */
export type RetireMachineState =
  | (NonNullable<FormState<CommandError<typeof retireMachineCommand>, RetireMachineField>> & { asking?: undefined })
  | { asking: true; error?: undefined; values: Values; openDefects: number; problemReports: number }
  | { asking: false; error?: undefined; values: Values }
  | null;

/**
 * CMD-RetireMachine from the page „Ausmustern · LG-013“ (ST-039) – Repair's command, with its retirement policies (ADR
 * 0010), through the Server Action runner (ST-073). Sending the reason only asks: the question names how many open
 * defects will be closed and problem reports dismissed (G10). Afterwards the technician is back on the machine record
 * with „LG-013 ist ausgemustert.“ (G3). The page binds the museum number.
 */
const retireMachine = formAction(retireMachineCommand, {
  fields: retireMachineFields,
  input: retireMachineInput,
  onSuccess: async ({ museumNumber }) => {
    const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
    revalidatePath("/team/machines");
    revalidatePath(record);
    redirect(`${record}?retired=1`);
  },
});

export async function retireMachineAction(
  museumNumber: string,
  previous: RetireMachineState,
  formData: FormData,
): Promise<RetireMachineState> {
  const technician = await requireTechnician(); // the page's access check; who may retire is the command's allowedActors
  const step = retireStep(formData);
  const values = keptValues(formData);
  if (step === "back") return { asking: false, values };
  if (step === "ask") {
    // Never ask about nothing: a missing reason is the command's own rejection, shown at the form (G8).
    const refusal = retireReasonRefusal(values.reason);
    if (refusal) return { error: refusal, values };
    const db = database();
    const machine = await machineForTeamForm(db, museumNumber);
    if (!machine) return { error: "not-found", values };
    // Never ask the final question about a machine that was retired meanwhile (G10) – say so at the form.
    const notNow = retireRefusal(machine, technician);
    if (notNow) return { error: notNow, values };
    return { asking: true, values, ...(await retirementConsequences(db, machine.id)) };
  }
  return retireMachine(null, formData);
}
