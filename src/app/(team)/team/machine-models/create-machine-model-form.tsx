"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import type { MachineCategory, Technology } from "@/modules/collection";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { createMachineModelAction } from "./actions";

const { machineModels: texts, terms } = teamMessages;

/**
 * What the two selects offer. The page builds them – a client component must not import the Collection module
 * itself, or the module's server code (and with it `pg`) would end up in the browser bundle; only the types are
 * imported, and those are erased.
 */
export type Choices = {
  categories: { value: MachineCategory; label: string }[];
  /** Every technology once, its label naming the machine categories it fits. */
  technologies: { value: Technology; label: string }[];
};

/**
 * The machine model form (ST-006), run through the Server Action runner (ST-073, Q9): a rejection shows the
 * catalogue text of its error code and keeps what was typed – with and without JavaScript.
 *
 * Which technologies fit which machine category is shown in each technology's label, not by hiding the ones that
 * do not fit: without JavaScript nothing can be filtered in the browser, and CMD-CreateMachineModel rejects a
 * combination that does not fit (AGG-MachineModel's invariant) with its own reason. Every technology appears
 * exactly once – two options with the same value would make the browser echo the first one after a rejection,
 * whichever the technician really chose.
 */
export function CreateMachineModelForm({ categories, technologies }: Choices) {
  const [state, action, pending] = useActionState(createMachineModelAction, null);
  const kept = state ? JSON.stringify(state) : "empty";

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={texts.modelTitle}>
        <Input name="title" defaultValue={state?.values.title} key={`title-${kept}`} required />
      </Field>
      <Field label={texts.manufacturer}>
        <Input name="manufacturer" defaultValue={state?.values.manufacturer} key={`manufacturer-${kept}`} required />
      </Field>
      <Field label={texts.year}>
        <Input name="year" inputMode="numeric" defaultValue={state?.values.year} key={`year-${kept}`} />
      </Field>
      <Field label={terms["Machine category"]}>
        <NativeSelect
          name="machineCategory"
          defaultValue={state?.values.machineCategory ?? ""}
          key={`category-${kept}`}
          required
        >
          <option value="">{texts.choose}</option>
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={terms.Technology}>
        <NativeSelect name="technology" defaultValue={state?.values.technology} key={`technology-${kept}`}>
          <option value="">{texts.noTechnology}</option>
          {technologies.map((technology) => (
            <option key={technology.value} value={technology.value}>
              {technology.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {state && <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>}
      <Button type="submit" disabled={pending}>
        {texts.create}
      </Button>
    </form>
  );
}
