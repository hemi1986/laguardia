"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import type { MachineStatus } from "@/modules/collection";
import type { Priority } from "@/modules/repair";
import { commandErrorText, teamMessages } from "@/platform/messages";
import type { RecordDefectState } from "./actions";
import type { RecordDefectField } from "./record-defect-input";

const { recordDefect: texts, machines } = teamMessages;

type ErrorCode = NonNullable<RecordDefectState>["error"];

/** The field that caused a rejection – marked at the form (G8). */
const fieldOf: Partial<Record<ErrorCode, RecordDefectField>> = {
  "title-required": "title",
  "machine-status-not-stricter": "machineStatus",
};

const priorityOrder: Priority[] = ["high", "normal", "low"];

/**
 * The form „Defekt erfassen“ (ST-018, story review 2026-10-03): title, priority (normal preselected), the mark for
 * helpers and – only when there is a stricter one – the machine status in the same step, „Status nicht ändern“
 * preselected. There is no reason field: the status history's reason is the defect's title. A rejection keeps every
 * choice and marks the field (G8), with and without JavaScript.
 */
export function RecordDefectForm({
  action: record,
  version,
  museumNumber,
  machine,
}: {
  action: (previous: RecordDefectState, formData: FormData) => Promise<RecordDefectState>;
  version: number;
  museumNumber: string;
  machine: { status: MachineStatus; version: number; stricter: MachineStatus[] };
}) {
  const [state, action, pending] = useActionState(record, null);
  const rejectionId = useId();
  const kept = state ? JSON.stringify(state) : "empty";
  const invalid = state ? fieldOf[state.error] : undefined;
  const marked = (field: RecordDefectField, hint?: string) => {
    const describedBy = [hint, invalid === field ? rejectionId : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": invalid === field || undefined, "aria-describedby": describedBy || undefined };
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="version" value={version} />
      <Field data-invalid={invalid === "title"}>
        <FieldLabel htmlFor="title">{texts.defectTitle}</FieldLabel>
        <Input id="title" name="title" defaultValue={state?.values.title} key={`title-${kept}`} {...marked("title", "title-hint")} />
        <FieldDescription id="title-hint">{texts.titleHint}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="priority">{texts.priority}</FieldLabel>
        <NativeSelect id="priority" name="priority" defaultValue={state?.values.priority || "normal"} key={`priority-${kept}`}>
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
          defaultChecked={state ? state.values.suitableForHelpers !== "" : false}
          key={`suitableForHelpers-${kept}`}
          className="size-4"
        />
        {texts.suitableForHelpers}
      </label>
      {machine.stricter.length === 0 ? (
        <p className="text-sm">{texts.statusStays(museumNumber, machines.statuses[machine.status])}</p>
      ) : (
        <Field data-invalid={invalid === "machineStatus"}>
          <FieldLabel htmlFor="machineStatus">{texts.status}</FieldLabel>
          <FieldDescription id="machineStatus-hint">
            {texts.currentStatus(museumNumber, machines.statuses[machine.status])}
          </FieldDescription>
          <input type="hidden" name="machineVersion" value={machine.version} />
          <NativeSelect
            id="machineStatus"
            name="machineStatus"
            defaultValue={state?.values.machineStatus ?? ""}
            key={`machineStatus-${kept}`}
            {...marked("machineStatus", "machineStatus-hint")}
          >
            <option value="">{texts.keepStatus}</option>
            {machine.stricter.map((status) => (
              <option key={status} value={status}>
                {machines.statuses[status]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {state && (
        <div id={rejectionId} className="flex flex-col gap-2">
          <Rejection>{rejectionText(state, museumNumber)}</Rejection>
          {state.error === "already-triaged" && (
            <Link href="/team/triage" className="self-start text-sm underline underline-offset-4">
              {texts.toTriage}
            </Link>
          )}
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.submit}
      </Button>
    </form>
  );
}

/** The rejection in words – naming who triaged it first, or the machine retired meanwhile (story review 2026-10-03). */
function rejectionText(state: NonNullable<RecordDefectState>, museumNumber: string): string {
  if (state.error === "already-triaged" && state.triagedBy) return texts.alreadyTriagedBy(state.triagedBy);
  if (state.error === "machine-retired") return texts.retiredMeanwhile(museumNumber);
  return commandErrorText(teamMessages, state.error);
}
