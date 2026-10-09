import { randomUUID } from "node:crypto";
import {
  executeCommand,
  type Actor,
  type Command,
  type CommandDependencies,
  type CommandError,
} from "@/platform/command";
import { removePhoto, withStoredPhoto, type PhotoError, type PhotoOwner, type PhotoReference } from "@/photo";
import { blobStorage, type ContentStorage } from "@/platform/storage";

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

export function formRunner({ currentPerson, storage, ...dependencies }: RunnerDependencies) {
  return function formAction<Input, Result, Error extends string, const Field extends string>(
    command: Command<Input, Result, Error>,
    definition: FormDefinition<Input, Result, Field>,
  ) {
    return async (
      _previous: FormState<CommandError<typeof command>, Field>,
      formData: FormData,
    ): Promise<FormState<CommandError<typeof command>, Field>> => {
      const fields = fieldsOf(formData, definition.fields);
      const outcome = await executeCommand(command, definition.input(fields), {
        ...dependencies,
        actor: await currentPerson(),
      });
      if (!outcome.ok) return { error: outcome.error, values: valuesOf(fields) };
      const removed = definition.removesPhoto?.(outcome.result);
      if (removed) await removePhoto(storage ?? blobStorage(), removed);
      await definition.onSuccess(outcome.result);
      return null;
    };
  };
}

/**
 * The runner of a form with a photo (ST-016, moved from ST-073): the same runner, but the command runs through the photo
 * module's "store, run, delete on failure" – a rejected form leaves no stored photo, and a photo that cannot be
 * accepted or stored rejects the form like a command would, keeping the typed values.
 */
export function photoFormRunner({ currentPerson, storage, ...dependencies }: RunnerDependencies) {
  return function photoFormAction<Input, Result, Error extends string, const Field extends string>(
    command: Command<Input, Result, Error>,
    definition: PhotoFormDefinition<Input, Result, Field>,
  ) {
    type State = FormState<CommandError<typeof command> | PhotoError, Field>;
    return async (_previous: State, formData: FormData): Promise<State> => {
      const fields = fieldsOf(formData, definition.fields);
      const actor = await currentPerson();
      const outcome = await withStoredPhoto(
        await sentPhotoOf(formData, definition.photo.field),
        definition.photo.owner,
        { storage: storage ?? blobStorage(), newId: dependencies.newId ?? randomUUID },
        (photo) => executeCommand(command, definition.input(fields, photo), { ...dependencies, actor }),
      );
      if (!outcome.ok) return { error: outcome.error, values: valuesOf(fields) };
      await definition.onSuccess(outcome.result);
      return null;
    };
  };
}

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
