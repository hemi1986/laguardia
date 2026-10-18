import "server-only";
import { currentPerson } from "./current-person";
import { formRunner, photoFormRunner, uploadFormRunner } from "./form-runner";

/**
 * The runner every Server Action uses (ST-073): `formAction(command, { fields, input, onSuccess })` gives the
 * action for `useActionState`. The acting person comes from `currentPerson()` – there is no way to pass one.
 */
export const formAction = formRunner({ currentPerson });

export type { FormFields, FormState, UploadFormDefinition } from "./form-runner";

/** The runner of a form with a photo (ST-016): the same acting person, the photo through the photo module. */
export const photoFormAction = photoFormRunner({ currentPerson });

/** The runner of a form that attaches a file uploaded from the browser (ST-037): the content through the upload module. */
export const uploadFormAction = uploadFormRunner({ currentPerson });
