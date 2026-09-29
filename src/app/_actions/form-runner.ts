import {
  executeCommand,
  type Actor,
  type Command,
  type CommandDependencies,
  type CommandError,
} from "@/platform/command";

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
};

export type RunnerDependencies = Omit<CommandDependencies, "actor"> & { currentPerson: () => Promise<Actor> };

export function formRunner({ currentPerson, ...dependencies }: RunnerDependencies) {
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
      await definition.onSuccess(outcome.result);
      return null;
    };
  };
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
