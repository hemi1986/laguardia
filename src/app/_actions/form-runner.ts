import { randomUUID } from "node:crypto";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import {
  executeCommand,
  type Actor,
  type Command,
  type CommandDependencies,
  type CommandError,
} from "@/platform/command";
import { removePhoto, withStoredPhoto, type PhotoError, type PhotoOwner, type PhotoReference } from "@/photo";
import { blobStorage, type ContentStorage } from "@/platform/storage";
import { withUploadedContent, type UploadedContent, type UploadedContentError, type UploadOwner } from "@/upload";

/**
 * The Server Action runner (ST-073, architecture review 2026-09-27 Q9/Q10/Q19) – the one way from a form to a
 * command. It takes the acting person from `currentPerson()` only: neither a Server Action nor the form can pass one
 * (lint keeps `executeCommand` and this factory out of the rest of `src/app/`). Pages use `formAction`
 * (`./form-action.ts`), which is this runner bound to the login session.
 */

/** The declared fields of a post: a missing field (or a file) is undefined – the input function decides nothing. */
export type FormFields<Field extends string> = { readonly [F in Field]: string | undefined };

/** What `useActionState` holds: null before the first post and after a success; on a rejection the error and input. */
export type FormState<Error extends string, Field extends string> = {
  error: Error;
  values: { readonly [F in Field]: string };
} | null;

export type FormDefinition<Input, Result, Field extends string> = {
  /** The form's own fields – only these reach the input function and come back after a rejection. */
  fields: readonly Field[];
  /** Reads and converts the fields (Q19): no validation, no default – a missing value stays "no value given". */
  input: (fields: FormFields<Field>) => Input;
  /**
   * The photo the command removed on purpose, if any (ST-020: a spam dismissal) – deleted from the storage after the
   * command was committed, before `onSuccess`. A failed delete is logged and does not undo the command (ADR 0007).
   */
  removesPhoto?: (result: Result) => PhotoReference | undefined;
  /** After the command succeeded, e.g. `revalidatePath` and `redirect` (which ends the action). */
  onSuccess: (result: Result) => Promise<void>;
};

/** `storage`: where a form's photo is stored (ST-016) or a removed one deleted (ST-020) – Vercel Blob unless a test injects another. */
export type RunnerDependencies = Omit<CommandDependencies, "actor"> & {
  currentPerson: () => Promise<Actor>;
  storage?: ContentStorage;
};

/** A form with a photo (ST-016) – its file field and whom the photo belongs to; the input gets the photo's reference. */
export type PhotoFormDefinition<Input, Result, Field extends string> = Omit<
  FormDefinition<Input, Result, Field>,
  "input" | "removesPhoto"
> & {
  photo: { field: string; owner: PhotoOwner };
  input: (fields: FormFields<Field>, photo: PhotoReference | undefined) => Input;
};

/** After a rejection of a form with a photo: also whether the photo must be chosen again (G8a) – set only then. */
export type PhotoFormState<Error extends string, Field extends string> =
  (NonNullable<FormState<Error, Field>> & { photoAgain?: true }) | null;

/**
 * A form that attaches content uploaded from the browser (ST-037): the field that carries the content's name, whom the
 * pending upload belongs to, the form's own rejections (checked first), and the input with the uploaded content.
 */
export type UploadFormDefinition<Input, Result, Field extends string, Refusal extends string> = Omit<
  FormDefinition<Input, Result, Field>,
  "input" | "removesPhoto"
> & {
  upload: {
    /** The field with the uploaded content's name. */
    field: Field;
    /** Fields emptied together with it when the content is gone – those that only describe the chosen file. */
    clearedWith?: readonly Field[];
    owner: (fields: FormFields<Field>) => UploadOwner;
  };
  /** The command's rejections that need nothing but the fields – asked before the content is handed over. */
  refusal: (fields: FormFields<Field>) => Refusal | undefined;
  input: (fields: FormFields<Field>, content: UploadedContent) => Input;
};

/**
 * The rejections of the photo itself (ST-016): their texts already say to choose another photo or leave it out. A photo
 * that could not be stored (`not-stored`) is not one of them – the photo was fine, and "try again" needs it again.
 */
const photoRejections: readonly string[] = ["too-large", "not-an-image", "unsupported-format"] satisfies PhotoError[];

/**
 * One runner for every form (architecture review 2026-10-18): the fields, the command as the acting person, and
 * `onSuccess` – with an optional content step around the command, chosen by the definition:
 * - **none** – the command alone;
 * - **`photo`** (ST-016) – through the photo module's "store, run, delete on failure": a rejected form leaves no stored
 *   photo, a photo that cannot be accepted or stored rejects the form like a command would, and a rejection of a form
 *   that had a photo attached says it must be chosen again (`photoAgain`, G8a) – not after a rejection of the photo
 *   itself (user, 2026-10-10);
 * - **`upload`** (ST-037, ADR 0009) – the form's own rejections (`refusal`) come first and keep the uploaded content,
 *   the chosen file is still attached for the next send (user, 2026-10-18); then the command runs through the upload
 *   module's `withUploadedContent`: a rejected command, content that is gone or too large leaves no content behind,
 *   and the form state no longer names it – the file must be chosen again.
 */
export function formRunner({ currentPerson, storage, ...dependencies }: RunnerDependencies) {
  function formAction<Input, Result, Error extends string, Refusal extends Error, const Field extends string>(
    command: Command<Input, Result, Error>,
    definition: UploadFormDefinition<Input, Result, Field, Refusal>,
  ): FormStateAction<FormState<CommandError<typeof command> | UploadedContentError | "file-required", Field>>;
  function formAction<Input, Result, Error extends string, const Field extends string>(
    command: Command<Input, Result, Error>,
    definition: PhotoFormDefinition<Input, Result, Field>,
  ): FormStateAction<PhotoFormState<CommandError<typeof command> | PhotoError, Field>>;
  function formAction<Input, Result, Error extends string, const Field extends string>(
    command: Command<Input, Result, Error>,
    definition: FormDefinition<Input, Result, Field>,
  ): FormStateAction<FormState<CommandError<typeof command>, Field>>;
  function formAction<Input, Result, Error extends string, const Field extends string>(
    command: Command<Input, Result, Error>,
    definition:
      | FormDefinition<Input, Result, Field>
      | PhotoFormDefinition<Input, Result, Field>
      | UploadFormDefinition<Input, Result, Field, Error>,
  ): FormStateAction<PhotoFormState<string, Field>> {
    return async (_previous, formData) => {
      const fields = fieldsOf(formData, definition.fields);
      const rejected = (error: string, values = valuesOf(fields)) => ({ error, values });

      if ("upload" in definition) {
        const name = fields[definition.upload.field];
        const refusal = definition.refusal(fields);
        if (refusal) return rejected(refusal);
        if (!name) return rejected("file-required");
        const actor = await currentPerson();
        const outcome = await withUploadedContent(
          {
            db: dependencies.db ?? database(),
            storage: storage ?? blobStorage(),
            clock: dependencies.clock ?? systemClock,
            newId: dependencies.newId ?? randomUUID,
          },
          { name, owner: definition.upload.owner(fields) },
          (content) => executeCommand(command, definition.input(fields, content), { ...dependencies, actor }),
        );
        if (!outcome.ok) {
          const gone: readonly string[] = [definition.upload.field, ...(definition.upload.clearedWith ?? [])];
          const values = Object.fromEntries(
            Object.entries(valuesOf(fields)).map(([field, value]) => [field, gone.includes(field) ? "" : value]),
          ) as { readonly [F in Field]: string };
          return rejected(outcome.error, values);
        }
        await definition.onSuccess(outcome.result);
        return null;
      }

      if ("photo" in definition) {
        const actor = await currentPerson();
        const photo = await sentPhotoOf(formData, definition.photo.field);
        const outcome = await withStoredPhoto(
          photo,
          definition.photo.owner,
          { storage: storage ?? blobStorage(), newId: dependencies.newId ?? randomUUID },
          (reference) => executeCommand(command, definition.input(fields, reference), { ...dependencies, actor }),
        );
        if (!outcome.ok) {
          const again = photo !== undefined && !photoRejections.includes(outcome.error);
          return again ? { ...rejected(outcome.error), photoAgain: true } : rejected(outcome.error);
        }
        await definition.onSuccess(outcome.result);
        return null;
      }

      const outcome = await executeCommand(command, definition.input(fields), {
        ...dependencies,
        actor: await currentPerson(),
      });
      if (!outcome.ok) return rejected(outcome.error);
      const removed = definition.removesPhoto?.(outcome.result);
      if (removed) await removePhoto(storage ?? blobStorage(), removed);
      await definition.onSuccess(outcome.result);
      return null;
    };
  }
  return formAction;
}

/** The action `useActionState` takes: the previous state and the post. */
type FormStateAction<State> = (previous: State, formData: FormData) => Promise<State>;

/** The bytes of the posted file – none for a missing, empty or non-file field. */
async function sentPhotoOf(formData: FormData, field: string): Promise<Uint8Array | undefined> {
  const file = formData.get(field);
  if (!(file instanceof Blob) || file.size === 0) return undefined;
  return new Uint8Array(await file.arrayBuffer());
}

function fieldsOf<Field extends string>(formData: FormData, names: readonly Field[]): FormFields<Field> {
  return Object.fromEntries(
    names.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === "string" ? value : undefined];
    }),
  ) as FormFields<Field>;
}

function valuesOf<Field extends string>(fields: FormFields<Field>): { readonly [F in Field]: string } {
  return Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, value ?? ""])) as {
    readonly [F in Field]: string;
  };
}
