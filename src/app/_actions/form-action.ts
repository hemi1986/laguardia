import "server-only";
import { currentPerson } from "./current-person";
import { formRunner, photoFormRunner } from "./form-runner";

/**
 * The runner every Server Action uses (ST-073): `formAction(command, { fields, input, onSuccess })` gives the
 * action for `useActionState`. The acting person comes from `currentPerson()` – there is no way to pass one.
 */
export const formAction = formRunner({ currentPerson });

export type { FormFields, FormState } from "./form-runner";

/** The runner of a form with a photo (ST-016): the same acting person, the photo through the photo module. */
export const photoFormAction = photoFormRunner({ currentPerson });
