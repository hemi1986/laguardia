"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { MachineStatus } from "@/modules/collection";
import type { Priority } from "@/modules/repair";
import { teamMessages } from "@/platform/messages";
import { VersionField } from "@/app/_actions/form-parts";

const { recordDefect: texts, machines } = teamMessages;

const priorityOrder: Priority[] = ["high", "normal", "low"];

/** The defect's own fields – what a rejection echoes of them (ST-073). */
export type DefectField = "title" | "priority" | "suitableForHelpers" | "machineStatus";

/**
 * The fields of a new defect (ST-018, story review 2026-10-03), shared by the form „Defekt erfassen“ in triage and
 * the form that reports and records in the same step (ST-023) – beside the routes, like the other shared pieces: title, priority (normal preselected), the mark for
 * helpers and – only when there is a stricter one – the machine status, „Status nicht ändern“ preselected. There is
 * no reason field: the status history's reason is the defect's title. `values` are the ones a rejection kept, `kept`
 * the key that makes React show them again; `invalid` marks the field a rejection is about (G8).
 */
export function DefectFields({
  values,
  kept,
  invalid,
  rejectionId,
  museumNumber,
  machine,
}: {
  values: { readonly [F in DefectField]: string } | undefined;
  kept: string;
  invalid: string | undefined;
  rejectionId: string;
  museumNumber: string;
  machine: { status: MachineStatus; version: number; stricter: MachineStatus[] };
}) {
  const marked = (field: DefectField, hint?: string) => {
    const describedBy = [hint, invalid === field ? rejectionId : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": invalid === field || undefined, "aria-describedby": describedBy || undefined };
  };

  return (
    <>
      <Field data-invalid={invalid === "title"}>
        <FieldLabel htmlFor="title">{texts.defectTitle}</FieldLabel>
        <Input
          id="title"
          name="title"
          defaultValue={values?.title}
          key={`title-${kept}`}
          {...marked("title", "title-hint")}
        />
        <FieldDescription id="title-hint">{texts.titleHint}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="priority">{texts.priority}</FieldLabel>
        <NativeSelect
          id="priority"
          name="priority"
          defaultValue={values?.priority || "normal"}
          key={`priority-${kept}`}
        >
          {priorityOrder.map((priority) => (
            <option key={priority} value={priority}>
              {texts.priorities[priority]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="suitableForHelpers"
          defaultChecked={values ? values.suitableForHelpers !== "" : false}
          key={`suitableForHelpers-${kept}`}
          className="size-4"
        />
        {texts.suitableForHelpers}
      </label>
      <MachineStatusChoice
        museumNumber={museumNumber}
        machine={machine}
        value={values?.machineStatus}
        kept={kept}
        aria={marked("machineStatus", "machineStatus-hint")}
        invalid={invalid === "machineStatus"}
      />
    </>
  );
}

/**
 * The machine status chosen in the same step as a defect is recorded (ST-018) or reopened (ST-030) – only when there
 * is a stricter status, „Status nicht ändern“ preselected; otherwise a sentence that the status stays. Posts the
 * machine's version beside it (HS-16).
 */
export function MachineStatusChoice({
  museumNumber,
  machine,
  value,
  kept,
  aria,
  invalid,
}: {
  museumNumber: string;
  machine: { status: MachineStatus; version: number; stricter: MachineStatus[] };
  value: string | undefined;
  kept: string;
  aria: { "aria-invalid"?: true; "aria-describedby"?: string };
  invalid: boolean;
}) {
  if (machine.stricter.length === 0)
    return <p className="text-sm">{texts.statusStays(museumNumber, machines.statuses[machine.status])}</p>;
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor="machineStatus">{texts.status}</FieldLabel>
      <FieldDescription id="machineStatus-hint">
        {texts.currentStatus(museumNumber, machines.statuses[machine.status])}
      </FieldDescription>
      <VersionField name="machineVersion" version={machine.version} />
      <NativeSelect
        id="machineStatus"
        name="machineStatus"
        defaultValue={value ?? ""}
        key={`machineStatus-${kept}`}
        {...aria}
      >
        <option value="">{texts.keepStatus}</option>
        {machine.stricter.map((status) => (
          <option key={status} value={status}>
            {machines.statuses[status]}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}
