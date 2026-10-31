"use client";

import { useActionState, useId } from "react";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { saveMuseumAction, type MuseumFormState } from "./actions";

const { museum: texts } = teamMessages.museumSettings;

type MuseumFormProps = { version: number; museumName: string; machinesListed: boolean };

/**
 * The form „Museum“ of the museum settings (ST-100): the museum name and whether the machines are listed on the welcome
 * page, saved on its own. Native controls only, so it works without JavaScript.
 */
export function MuseumForm(props: MuseumFormProps) {
  const [state, action, pending] = useActionState(saveMuseumAction, null);
  return <MuseumFormContent {...props} state={state} action={action} pending={pending} />;
}

/**
 * The form as it looks in an action state: a rejection keeps what was typed and the checkbox as it was sent, and names the
 * reason at the form – at the name when the name caused it (G8, G9).
 */
export function MuseumFormContent({
  version,
  museumName,
  machinesListed,
  state,
  action,
  pending = false,
}: MuseumFormProps & { state: MuseumFormState; action?: (formData: FormData) => void; pending?: boolean }) {
  const rejectionId = useId();
  const kept = keptKey(state);
  const nameInvalid = state?.error === "museum-name-required";

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <Field data-invalid={nameInvalid}>
        <FieldLabel htmlFor="museumName">{texts.museumName}</FieldLabel>
        <Input
          id="museumName"
          name="museumName"
          defaultValue={state ? state.values.museumName : museumName}
          key={`museumName-${kept}`}
          required
          aria-invalid={nameInvalid || undefined}
          aria-describedby={nameInvalid ? rejectionId : undefined}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          name="machinesListed"
          defaultChecked={state ? !!state.values.machinesListed : machinesListed}
          key={`machinesListed-${kept}`}
        />
        {texts.machinesListed}
      </label>
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.save}
      </Button>
    </form>
  );
}
