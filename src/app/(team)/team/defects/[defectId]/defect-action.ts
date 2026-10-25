import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defectActionCommands, type DefectAction } from "@/modules/repair";
import { formAction, type FormFields, type FormState, type PhotoFormState } from "@/app/_actions/form-action";
import type { PhotoError, PhotoOwner } from "@/photo";
import type { Command, CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../team-session";
import { defectDoneAddress } from "./defect-action-pages";

type CommandOf<A extends DefectAction> = (typeof defectActionCommands)[A];
type InputOf<A extends DefectAction> = CommandOf<A> extends Command<infer Input, unknown, string> ? Input : never;
type ErrorOf<A extends DefectAction> = CommandOf<A> extends Command<never, unknown, infer Error> ? Error : never;

/** Repair's commands per action, typed per action – indexed by `A`, the compiler knows the command is `A`'s own. */
const commands: { readonly [A in DefectAction]: Command<InputOf<A>, { defectId: string }, ErrorOf<A>> } =
  defectActionCommands;

/** What `useActionState` holds for a form of the action – the command's error and the form's own fields. */
export type DefectActionState<A extends DefectAction, Field extends string> = FormState<
  CommandError<Command<never, unknown, ErrorOf<A>>>,
  Field
>;

/** The state of a form on a defect that sends photos too (ST-032) – also the photo errors and `photoAgain` (G8a). */
export type DefectPhotosActionState<A extends DefectAction, Field extends string> = PhotoFormState<
  CommandError<Command<never, unknown, ErrorOf<A>>> | PhotoError,
  Field
>;

/**
 * The one way from a form on a defect to its action (architecture review 2026-10-18): the page's access check, the
 * action's command from Repair through the Server Action runner (ST-073) as the signed-in team member, then back on the
 * defect's page with `?done=<action>`, which confirms it when the journal says so too (G3). A form folder only says
 * which fields it reads and how they become the command's input; the page binds the defect's ID. `defectPhotosFormAction`
 * is the same for a form that sends photos (ST-032).
 */
export function defectFormAction<A extends DefectAction, const Field extends string>(
  action: A,
  definition: { fields: readonly Field[]; input: (fields: FormFields<Field>) => InputOf<A> },
) {
  const command = commands[action];
  return async (previous: DefectActionState<A, Field>, formData: FormData): Promise<DefectActionState<A, Field>> => {
    await requireTeamMember(); // the page's access check
    return formAction(command, { ...definition, onSuccess: backOnTheDefect(action) })(previous, formData);
  };
}

/** After an action on a defect: its page, which confirms the action (G3) – the lists show the change too. */
function backOnTheDefect(action: DefectAction) {
  return async ({ defectId }: { defectId: string }) => {
    revalidatePath("/team/defects");
    redirect(defectDoneAddress(defectId, action));
  };
}

export function defectPhotosFormAction<A extends DefectAction, const Field extends string>(
  action: A,
  definition: {
    fields: readonly Field[];
    photos: { field: string; owner: PhotoOwner; atMost: { count: number; error: ErrorOf<A> } };
    input: (fields: FormFields<Field>, photos: string[]) => InputOf<A>;
  },
) {
  const command = commands[action];
  return async (
    previous: DefectPhotosActionState<A, Field>,
    formData: FormData,
  ): Promise<DefectPhotosActionState<A, Field>> => {
    await requireTeamMember(); // the page's access check
    return formAction(command, { ...definition, onSuccess: backOnTheDefect(action) })(previous, formData);
  };
}
