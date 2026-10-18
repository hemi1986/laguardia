import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defectActionCommands, type DefectAction } from "@/modules/repair";
import { formAction, type FormFields, type FormState } from "@/app/_actions/form-action";
import type { Command, CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../team-session";
import { defectDoneAddress } from "./defect-action-pages";

type CommandOf<A extends DefectAction> = (typeof defectActionCommands)[A];
type InputOf<A extends DefectAction> = CommandOf<A> extends Command<infer Input, unknown, string> ? Input : never;
type ErrorOf<A extends DefectAction> = CommandOf<A> extends Command<never, unknown, infer Error> ? Error : never;

/** What `useActionState` holds for a form of the action – the command's error and the form's own fields. */
export type DefectActionState<A extends DefectAction, Field extends string> = FormState<
  CommandError<Command<never, unknown, ErrorOf<A>>>,
  Field
>;

/**
 * The one way from a form on a defect to its action (architecture review 2026-10-18): the page's access check, the
 * action's command from Repair through the Server Action runner (ST-073) as the signed-in team member, then back on the
 * defect's page with `?done=<action>`, which confirms it when the journal says so too (G3). A form folder only says
 * which fields it reads and how they become the command's input; the page binds the defect's ID.
 */
export function defectFormAction<A extends DefectAction, const Field extends string>(
  action: A,
  definition: { fields: readonly Field[]; input: (fields: FormFields<Field>) => InputOf<A> },
) {
  // Repair names each action's command; indexed by a type parameter it is one of them – this one.
  const command = defectActionCommands[action] as unknown as Command<InputOf<A>, { defectId: string }, ErrorOf<A>>;
  return async (previous: DefectActionState<A, Field>, formData: FormData): Promise<DefectActionState<A, Field>> => {
    await requireTeamMember(); // the page's access check
    return formAction(command, {
      ...definition,
      onSuccess: async ({ defectId }) => {
        revalidatePath("/team/defects");
        redirect(defectDoneAddress(defectId, action));
      },
    })(previous, formData);
  };
}
