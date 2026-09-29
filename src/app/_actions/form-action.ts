import "server-only";
import { currentPerson } from "./current-person";
import { formRunner } from "./form-runner";

/**
 * The runner every Server Action uses (ST-073): `formAction(command, { fields, input, onSuccess })` gives the
 * action for `useActionState`. The acting person comes from `currentPerson()` – there is no way to pass one.
 */
export const formAction = formRunner({ currentPerson });

export type { FormFields, FormState } from "./form-runner";
