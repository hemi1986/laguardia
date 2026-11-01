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
import {
  LOGO_LIMITS,
  withStoredLogo,
  withStoredPhotos,
  type LogoError,
  type StoredLogo,
  type PhotoError, type PhotoOwner, type PhotoReference, type StoredPhoto } from "@/photo";
import { s3Storage, deleteRemovedContent, type ContentStorage } from "@/platform/storage";
import { withUploadedContent, type UploadedContent, type UploadedContentError, type UploadOwner } from "@/upload";
import { SEEN_FIELD, seenOf } from "./form-parts";

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
  /** After the command succeeded, e.g. `revalidatePath` and `redirect` (which ends the action). */
  onSuccess: (result: Result) => Promise<void>;
  /**
   * Fields that hold a secret (the OpenRouter key, ST-104): read like the others, but never sent back after a
   * rejection – their value in the state is empty, so the field is empty again (G36).
   */
  secret?: readonly Field[];
};

/** `storage`: where a form's photo is stored (ST-016) or removed content deleted (ST-020, ST-038) – Vercel Blob unless a test injects another. */
export type RunnerDependencies = Omit<CommandDependencies, "actor"> & {
  currentPerson: () => Promise<Actor>;
  storage?: ContentStorage;
};

/**
 * A form with a photo (ST-016) – its file field and whom the photo belongs to; the input gets the photo's reference,
 * and the stored photo with its size and media type for a command that keeps them (a file, ST-054).
 */
export type PhotoFormDefinition<Input, Result, Field extends string> = Omit<
  FormDefinition<Input, Result, Field>,
  "input"
> & {
  photo: { field: string; owner: PhotoOwner };
  input: (fields: FormFields<Field>, photo: PhotoReference | undefined, stored: StoredPhoto | undefined) => Input;
};

/**
 * A form with several photos (ST-032, a work log entry's) – its file field, posted once per photo, whom the photos
 * belong to, and the command's own rule on how many it takes with the command's error for too many: the runner refuses
 * too many before storing any (the command checks again), and that rejection is about the photos themselves – its text
 * says what to do, so it does not ask to choose them again (G8a). The input gets the photos' references.
 */
export type PhotosFormDefinition<Input, Result, Error extends string, Field extends string> = Omit<
  FormDefinition<Input, Result, Field>,
  "input"
> & {
  photos: { field: string; owner: PhotoOwner; atMost: { count: number; error: Error } };
  input: (fields: FormFields<Field>, photos: PhotoReference[]) => Input;
};

/**
 * A form with the museum's logo (ST-102) – its file field; the file reaches the server as chosen, without the browser's
 * photo preparation, and goes through the photo module's logo acceptance (format and transparency kept). The input gets
 * the stored logo. Its rejections are about the image itself, so none asks to choose it again (G8a).
 */
export type LogoFormDefinition<Input, Result, Field extends string> = Omit<
  FormDefinition<Input, Result, Field>,
  "input"
> & {
  logo: { field: string };
  input: (fields: FormFields<Field>, logo: StoredLogo) => Input;
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
  "input"
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
 * A form that runs its command once per chosen item (ST-045: one maintenance task on several machines) – the field the
 * browser posts once per ticked checkbox, and the input for one of them. `onSuccess` gets what was done and what was
 * rejected, item by item, as soon as one was done.
 */
export type EachFormDefinition<Input, Result, Error extends string, Field extends string> = Omit<
  FormDefinition<Input, Result, Field>,
  "input" | "onSuccess"
> & {
  each: { field: string };
  input: (fields: FormFields<Field>, item: string) => Input;
  onSuccess: (outcome: EachOutcome<Result, Error>) => Promise<void>;
};

/**
 * A form whose checkboxes are values of one command (ST-094: the machines of a new maintenance task) – the field the
 * browser posts once per ticked checkbox, and the input with all of them as posted. Unlike `each` the command runs once
 * for all, and nothing is left out: a value posted twice reaches the command twice, so it can reject it. With `seen`
 * (a set delta, ST-095) the form also posts what was ticked when the page opened, in a `SeenField`: the input gets it,
 * and a rejection keeps it.
 */
export type ManyFormDefinition<Input, Result, Field extends string> = Omit<
  FormDefinition<Input, Result, Field>,
  "input"
> & {
  many: { field: string; seen?: true };
  input: (fields: FormFields<Field>, chosen: readonly string[], seen: readonly string[]) => Input;
};

/**
 * After a rejection of such a form: the values that were chosen (a ticked checkbox is no field the state can echo),
 * those seen when the page opened (none without `seen`), and the IDs the decision named as the cause, if it did.
 */
export type ManyFormState<Error extends string, Field extends string> =
  | (NonNullable<FormState<Error, Field>> & {
      chosen: readonly string[];
      seen: readonly string[];
      subjects?: readonly string[];
    })
  | null;

/**
 * What a form run once per chosen item did: the items done with their results, the rejected ones with why, and those
 * never run because a command failed on the way (it is logged) – the ones done stay done.
 */
export type EachOutcome<Result, Error extends string> = {
  done: readonly { item: string; result: Result }[];
  rejected: readonly { item: string; error: Error }[];
  notRun: readonly string[];
};

/**
 * After a form run once per chosen item recorded nothing: the items that were chosen (a ticked checkbox is no field
 * the state can echo) and – only when the items were rejected for different reasons – each item's reason.
 */
export type EachFormState<Error extends string, Field extends string> =
  | (NonNullable<FormState<Error | "nothing-chosen", Field>> & {
      chosen: readonly string[];
      rejected?: readonly { item: string; error: Error }[];
    })
  | null;

/**
 * Which photo errors are rejections of the photo itself (ST-016): their texts already say to choose another photo or
 * leave it out. A photo that could not be stored (`not-stored`) is not one of them – the photo was fine, and "try
 * again" needs it again. A new photo error has to be decided here.
 */
const rejectsThePhoto = {
  "too-large": true,
  "not-an-image": true,
  "unsupported-format": true,
  "not-stored": false,
} as const satisfies Record<PhotoError, boolean>;

const isPhotoError = (error: string): error is PhotoError => Object.hasOwn(rejectsThePhoto, error);

/**
 * One runner for every form (architecture review 2026-10-18): the fields, the command as the acting person, and
 * `onSuccess` – with an optional content step around the command, chosen by the definition:
 * - **none** – the command alone;
 * - **`photo`** (ST-016) – through the photo module's "store, run, delete on failure": a rejected form leaves no stored
 *   photo, a photo that cannot be accepted or stored rejects the form like a command would, and a rejection of a form
 *   that had a photo attached says it must be chosen again (`photoAgain`, G8a) – not after a rejection of the photo
 *   itself (user, 2026-10-10);
 * - **`photos`** (ST-032) – the same for several photos: none is stored unless all are accepted, and all go again
 *   when one of them cannot be stored or the command rejects the form;
 * - **`upload`** (ST-037, ADR 0009) – the form's own rejections (`refusal`) come first and keep the uploaded content,
 *   the chosen file is still attached for the next send (user, 2026-10-18); then the command runs through the upload
 *   module's `withUploadedContent`: a rejected command, content that is gone or too large leaves no content behind,
 *   and the form state no longer names it – the file must be chosen again.
 * - **`logo`** (ST-102) – the museum's logo through the photo module's `withStoredLogo`: the same "store, run, delete
 *   on failure", with the logo's own acceptance;
 * - **`each`** (ST-045) – the command once per chosen item, each in its own transaction: a rejected item does not stop
 *   the others. Nothing chosen is rejected (`nothing-chosen`); when every item is rejected the form stays, with the
 *   one reason they share or each item's own.
 * - **`many`** (ST-094) – one command with all the values ticked in one field, as posted; a rejection keeps them, and
 *   what was seen when the page opened (`seen`, a set delta), and names the decision's subjects.
 * Each step is its own function, typed with the state its overload promises; `formAction` only picks the step.
 */
export function formRunner(dependencies: RunnerDependencies) {
  function formAction<Input, Result, Error extends string, const Field extends string>(
    command: Command<Input, Result, Error>,
    definition: EachFormDefinition<Input, Result, CommandError<Command<Input, Result, Error>>, Field>,
  ): FormStateAction<EachFormState<CommandError<typeof command>, Field>>;
  function formAction<Input, Result, Error extends string, const Field extends string>(
    command: Command<Input, Result, Error>,
    definition: ManyFormDefinition<Input, Result, Field>,
  ): FormStateAction<ManyFormState<CommandError<typeof command>, Field>>;
  function formAction<Input, Result, Error extends string, Refusal extends Error, const Field extends string>(
    command: Command<Input, Result, Error>,
    definition: UploadFormDefinition<Input, Result, Field, Refusal>,
  ): FormStateAction<UploadFormState<CommandError<typeof command>, Field>>;
  function formAction<Input, Result, Error extends string, const Field extends string>(
    command: Command<Input, Result, Error>,
    definition: LogoFormDefinition<Input, Result, Field>,
  ): FormStateAction<FormState<CommandError<typeof command> | LogoError, Field>>;
  function formAction<Input, Result, Error extends string, const Field extends string>(
    command: Command<Input, Result, Error>,
    definition: PhotoFormDefinition<Input, Result, Field>,
  ): FormStateAction<PhotoFormState<CommandError<typeof command> | PhotoError, Field>>;
  function formAction<Input, Result, Error extends string, const Field extends string>(
    command: Command<Input, Result, Error>,
    definition: PhotosFormDefinition<Input, Result, NoInfer<Error>, Field>,
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
      | PhotosFormDefinition<Input, Result, Error, Field>
      | UploadFormDefinition<Input, Result, Field, Error>
      | LogoFormDefinition<Input, Result, Field>
      | ManyFormDefinition<Input, Result, Field>
      | EachFormDefinition<Input, Result, CommandError<Command<Input, Result, Error>>, Field>,
  ) {
    if ("each" in definition) return eachStep(dependencies, command, definition);
    if ("many" in definition) return manyStep(dependencies, command, definition);
    if ("upload" in definition) return uploadStep(dependencies, command, definition);
    if ("logo" in definition) return logoStep(dependencies, command, definition);
    if ("photo" in definition) {
      // One photo: only the first file of its field is read – more files are never stored (code review ST-032).
      const { photo, input, ...rest } = definition;
      return photosStep(dependencies, command, {
        ...rest,
        photos: photo,
        input: (fields, [one], [stored]) => input(fields, one, stored),
      });
    }
    if ("photos" in definition) return photosStep(dependencies, command, definition);
    return withoutContent(dependencies, command, definition);
  }
  return formAction;
}

/** The state of a form with uploaded content: also its own rejections, a missing file, and content that is gone. */
type UploadFormState<Error extends string, Field extends string> = FormState<
  Error | UploadedContentError | "file-required",
  Field
>;

function withoutContent<Input, Result, Error extends string, Field extends string>(
  { currentPerson, storage, ...dependencies }: RunnerDependencies,
  command: Command<Input, Result, Error>,
  definition: FormDefinition<Input, Result, Field>,
): FormStateAction<FormState<CommandError<typeof command>, Field>> {
  return async (_previous, formData) => {
    const fields = fieldsOf(formData, definition.fields);
    const outcome = await executeCommand(command, definition.input(fields), {
      ...dependencies,
      actor: await currentPerson(),
    });
    if (!outcome.ok) return { error: outcome.error, values: valuesOf(fields, definition.secret) };
    await deleteWhatItRemoved(storage, command, outcome.result);
    await definition.onSuccess(outcome.result);
    return null;
  };
}

function photosStep<Input, Result, Error extends string, Field extends string>(
  { currentPerson, storage, ...dependencies }: RunnerDependencies,
  command: Command<Input, Result, Error>,
  definition: Omit<PhotosFormDefinition<Input, Result, Error, Field>, "photos" | "input"> & {
    photos: { field: string; owner: PhotoOwner; atMost?: { count: number; error: Error } };
    input: (fields: FormFields<Field>, photos: PhotoReference[], stored: StoredPhoto[]) => Input;
  },
): FormStateAction<PhotoFormState<CommandError<typeof command> | PhotoError, Field>> {
  const { field, owner, atMost } = definition.photos;
  return async (_previous, formData) => {
    const fields = fieldsOf(formData, definition.fields);
    const posted = postedPhotos(formData, field);
    if (atMost && posted.length > atMost.count) return { error: atMost.error, values: valuesOf(fields, definition.secret) };
    const actor = await currentPerson();
    // Without a rule on how many, the form has one photo: the first file posted in its field.
    const photos = await Promise.all(
      (atMost ? posted : posted.slice(0, 1)).map(async (file) => new Uint8Array(await file.arrayBuffer())),
    );
    const outcome = await withStoredPhotos(
      photos,
      owner,
      { storage: storage ?? s3Storage(), newId: dependencies.newId ?? randomUUID },
      (references, stored) =>
        executeCommand(command, definition.input(fields, references, stored), { ...dependencies, actor }),
    );
    if (!outcome.ok) {
      const state = { error: outcome.error, values: valuesOf(fields, definition.secret) };
      const ofThePhotos =
        (isPhotoError(outcome.error) && rejectsThePhoto[outcome.error]) || outcome.error === atMost?.error;
      return photos.length > 0 && !ofThePhotos ? { ...state, photoAgain: true } : state;
    }
    await deleteWhatItRemoved(storage, command, outcome.result);
    await definition.onSuccess(outcome.result);
    return null;
  };
}

function logoStep<Input, Result, Error extends string, Field extends string>(
  { currentPerson, storage, ...dependencies }: RunnerDependencies,
  command: Command<Input, Result, Error>,
  definition: LogoFormDefinition<Input, Result, Field>,
): FormStateAction<FormState<CommandError<typeof command> | LogoError, Field>> {
  return async (_previous, formData) => {
    const fields = fieldsOf(formData, definition.fields);
    const [file] = postedPhotos(formData, definition.logo.field);
    // Known before reading it: a file over the limit is not copied into memory (the acceptance checks again).
    if (file && file.size > LOGO_LIMITS.maxUploadBytes) return { error: "logo-too-large", values: valuesOf(fields, definition.secret) };
    const actor = await currentPerson();
    const outcome = await withStoredLogo(
      file && new Uint8Array(await file.arrayBuffer()),
      { storage: storage ?? s3Storage(), newId: dependencies.newId ?? randomUUID },
      (logo) => executeCommand(command, definition.input(fields, logo), { ...dependencies, actor }),
    );
    if (!outcome.ok) return { error: outcome.error, values: valuesOf(fields, definition.secret) };
    await deleteWhatItRemoved(storage, command, outcome.result);
    await definition.onSuccess(outcome.result);
    return null;
  };
}

function uploadStep<Input, Result, Error extends string, Refusal extends Error, Field extends string>(
  { currentPerson, storage, ...dependencies }: RunnerDependencies,
  command: Command<Input, Result, Error>,
  definition: UploadFormDefinition<Input, Result, Field, Refusal>,
): FormStateAction<UploadFormState<CommandError<typeof command>, Field>> {
  return async (_previous, formData) => {
    const fields = fieldsOf(formData, definition.fields);
    const name = fields[definition.upload.field];
    const refusal = definition.refusal(fields);
    if (refusal) return { error: refusal, values: valuesOf(fields, definition.secret) };
    if (!name) return { error: "file-required", values: valuesOf(fields, definition.secret) };
    const actor = await currentPerson();
    const outcome = await withUploadedContent(
      {
        db: dependencies.db ?? database(),
        storage: storage ?? s3Storage(),
        clock: dependencies.clock ?? systemClock,
        newId: dependencies.newId ?? randomUUID,
      },
      { name, owner: definition.upload.owner(fields) },
      (content) => executeCommand(command, definition.input(fields, content), { ...dependencies, actor }),
    );
    if (!outcome.ok) {
      const gone: readonly string[] = [definition.upload.field, ...(definition.upload.clearedWith ?? [])];
      const values = Object.fromEntries(
        Object.entries(valuesOf(fields, definition.secret)).map(([field, value]) => [field, gone.includes(field) ? "" : value]),
      ) as { readonly [F in Field]: string };
      return { error: outcome.error, values };
    }
    await deleteWhatItRemoved(storage, command, outcome.result);
    await definition.onSuccess(outcome.result);
    return null;
  };
}

function manyStep<Input, Result, Error extends string, Field extends string>(
  { currentPerson, storage, ...dependencies }: RunnerDependencies,
  command: Command<Input, Result, Error>,
  definition: ManyFormDefinition<Input, Result, Field>,
): FormStateAction<ManyFormState<CommandError<typeof command>, Field>> {
  return async (_previous, formData) => {
    const fields = fieldsOf(formData, definition.fields);
    // As posted, in the order of the form: a forged post may name one twice, which the command rejects.
    const chosen = formData.getAll(definition.many.field).filter((item): item is string => typeof item === "string");
    const seen = definition.many.seen ? seenOf(formData.get(SEEN_FIELD)) : [];
    const outcome = await executeCommand(command, definition.input(fields, chosen, seen), {
      ...dependencies,
      actor: await currentPerson(),
    });
    if (!outcome.ok) {
      const subjects = outcome.subjects ? { subjects: outcome.subjects } : {};
      return { error: outcome.error, values: valuesOf(fields, definition.secret), chosen, seen, ...subjects };
    }
    await deleteWhatItRemoved(storage, command, outcome.result);
    await definition.onSuccess(outcome.result);
    return null;
  };
}

function eachStep<Input, Result, Error extends string, Field extends string>(
  { currentPerson, storage, ...dependencies }: RunnerDependencies,
  command: Command<Input, Result, Error>,
  definition: EachFormDefinition<Input, Result, CommandError<typeof command>, Field>,
): FormStateAction<EachFormState<CommandError<typeof command>, Field>> {
  return async (_previous, formData) => {
    const fields = fieldsOf(formData, definition.fields);
    const chosen = [
      ...new Set(formData.getAll(definition.each.field).filter((item): item is string => typeof item === "string")),
    ];
    if (chosen.length === 0) return { error: "nothing-chosen", values: valuesOf(fields, definition.secret), chosen };
    const actor = await currentPerson();
    const done: { item: string; result: Result }[] = [];
    const rejected: { item: string; error: CommandError<typeof command> }[] = [];
    // One after the other, each in its own transaction (ST-045): what one machine's rules reject stays its own.
    let notRun: string[] = [];
    for (const [index, item] of chosen.entries()) {
      try {
        const outcome = await executeCommand(command, definition.input(fields, item), { ...dependencies, actor });
        if (outcome.ok) done.push({ item, result: outcome.result });
        else rejected.push({ item, error: outcome.error });
      } catch (error) {
        // Nothing done yet: the form fails as any other. Otherwise what was done must still be confirmed, or the team
        // member sends it again and records it twice – the rest is named as not run.
        if (done.length === 0) throw error;
        console.error("form stopped after a failed command:", error instanceof Error ? error.message : error);
        notRun = chosen.slice(index);
        break;
      }
    }
    for (const { result } of done) await deleteWhatItRemoved(storage, command, result);
    if (done.length === 0) {
      const shared = rejected.every(({ error }) => error === rejected[0].error);
      return { error: rejected[0].error, values: valuesOf(fields, definition.secret), chosen, ...(shared ? {} : { rejected }) };
    }
    await definition.onSuccess({ done, rejected, notRun });
    return null;
  };
}

/** The action `useActionState` takes: the previous state and the post. */
type FormStateAction<State> = (previous: State, formData: FormData) => Promise<State>;

/** The bytes of the posted file – none for a missing, empty or non-file field. */
/** The photos a form posted in its file field – an empty file (no photo chosen) is none. */
function postedPhotos(formData: FormData, field: string): Blob[] {
  return formData.getAll(field).filter((file): file is File => file instanceof Blob && file.size > 0);
}

function fieldsOf<Field extends string>(formData: FormData, names: readonly Field[]): FormFields<Field> {
  return Object.fromEntries(
    names.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === "string" ? value : undefined];
    }),
  ) as FormFields<Field>;
}

function valuesOf<Field extends string>(
  fields: FormFields<Field>,
  secret: readonly Field[] = [],
): { readonly [F in Field]: string } {
  return Object.fromEntries(
    Object.entries<string | undefined>(fields).map(([name, value]) => [
      name,
      secret.includes(name as Field) ? "" : (value ?? ""),
    ]),
  ) as {
    readonly [F in Field]: string;
  };
}

/**
 * Deletes the stored content a committed command says it removed (`Command.removesContent`, ST-020, ST-038) – after
 * the commit, so a failed delete is only logged and the removal stands (ADR 0009).
 */
async function deleteWhatItRemoved<Result>(
  storage: ContentStorage | undefined,
  command: { removesContent?: (result: Result) => string | undefined },
  result: Result,
): Promise<void> {
  const removed = command.removesContent?.(result);
  if (removed) await deleteRemovedContent(storage ?? s3Storage(), removed);
}
