import "server-only";
import { currentPerson } from "./current-person";
import { formRunner } from "./form-runner";

/**
 * The runner every Server Action uses (ST-073): `formAction(command, { fields, input, onSuccess })` gives the
 * action for `useActionState` – with `photo` for a form with a photo (ST-016), with `upload` for one that attaches a
 * file uploaded from the browser (ST-037). The acting person comes from `currentPerson()` – there is no way to pass one.
 */
export const formAction = formRunner({ currentPerson });

export type {
  EachFormState,
  EachOutcome,
  FormDefinition,
  FormFields,
  FormState,
  PhotoFormDefinition,
  PhotoFormState,
  UploadFormDefinition,
} from "./form-runner";
