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
 * One machine category to choose, with the technologies that fit it. The page builds it – a client component
 * must not import the Collection module itself, or the module's server code (and with it `pg`) would end up in
 * the browser bundle; only the types are imported, and those are erased.
 */
export type MachineCategoryChoice = {
  value: MachineCategory;
  label: string;
  technologies: { value: Technology; label: string }[];
};

/**
 * The machine model form (ST-006), run through the Server Action runner (ST-073, Q9): a rejection shows the
 * catalogue text of its error code and keeps what was typed – with and without JavaScript.
 *
 * Which technologies fit which machine category is shown by grouping them, not by hiding them: without
 * JavaScript nothing can be filtered in the browser, and CMD-CreateMachineModel rejects a combination that does
 * not fit (AGG-MachineModel's invariant) with its own reason.
 */
export function CreateMachineModelForm({ categories }: { categories: MachineCategoryChoice[] }) {
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
      <Field label={texts.machineCategory}>
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
          {categories
            .filter((category) => category.technologies.length > 0)
            .map((category) => (
              <optgroup key={category.value} label={category.label}>
                {category.technologies.map((technology) => (
                  <option key={technology.value} value={technology.value}>
                    {technology.label}
                  </option>
                ))}
              </optgroup>
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
