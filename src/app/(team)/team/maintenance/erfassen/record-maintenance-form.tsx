"use client";

import { useActionState, useId } from "react";
import { keptKey } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import { rejectionText } from "@/app/_actions/rejection-text";
import type { RecordMaintenanceState } from "./actions";
import type { RecordMaintenanceField } from "./record-maintenance-input";

const { recordMaintenance: texts } = teamMessages;

type ErrorCode = NonNullable<RecordMaintenanceState>["error"];

/** The field that caused a rejection – marked at the form (G8). */
const fieldOf: Partial<Record<ErrorCode, RecordMaintenanceField>> = {
  "outcome-required": "outcome",
  "date-invalid": "date",
  "date-too-early": "date",
  "date-in-the-future": "date",
};

/**
 * The form „Wartung erfassen“ (ST-044) on shadcn's Field (G8, G9): the outcome as a native select, the date as a native
 * date field – today preselected, at most 7 days back –, an optional note; it works without JavaScript. The maintenance
 * task and the machine are posted as hidden fields (team pages may post IDs); the command checks them again.
 */
export function RecordMaintenanceForm({
  action: record,
  maintenanceTaskId,
  machineId,
  today,
  earliest,
  whyNot,
}: {
  action: (previous: RecordMaintenanceState, formData: FormData) => Promise<RecordMaintenanceState>;
  maintenanceTaskId: string;
  machineId: string;
  today: string;
  earliest: string;
  /** Why CMD-RecordMaintenance would refuse this team member here – its own reason (G11). */
  whyNot: TeamCommandErrorCode | undefined;
}) {
  const [state, action, pending] = useActionState(record, null);
  const rejectionId = useId();
  // Shown in place of the form only while there is nothing to keep: a rejection after the machine was retired or the
  // task removed meanwhile keeps the form, the typed note and the reason (engineering conventions, ST-019 review).
  if (whyNot && !state) return <p>{commandErrorText(teamMessages, whyNot)}</p>;
  const kept = keptKey(state);
  const invalid = state ? fieldOf[state.error] : undefined;
  const marked = (field: RecordMaintenanceField, hint?: string) => {
    const describedBy = [hint, invalid === field ? rejectionId : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": invalid === field || undefined, "aria-describedby": describedBy || undefined };
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="maintenanceTaskId" value={maintenanceTaskId} />
      <input type="hidden" name="machineId" value={machineId} />
      <Field data-invalid={invalid === "outcome"}>
        <FieldLabel htmlFor="outcome">{texts.outcome}</FieldLabel>
        <NativeSelect
          id="outcome"
          name="outcome"
          defaultValue={state?.values.outcome ?? ""}
          key={`outcome-${kept}`}
          required
          {...marked("outcome")}
        >
          <option value="">{texts.chooseOutcome}</option>
          <option value="done">{texts.outcomes.done}</option>
          <option value="partially-done">{texts.outcomes["partially-done"]}</option>
        </NativeSelect>
      </Field>
      <Field data-invalid={invalid === "date"}>
        <FieldLabel htmlFor="date">{texts.date}</FieldLabel>
        <Input
          id="date"
          name="date"
          type="date"
          min={earliest}
          max={today}
          defaultValue={state?.values.date ?? today}
          key={`date-${kept}`}
          {...marked("date", "date-hint")}
        />
        <FieldDescription id="date-hint">{texts.dateHint}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="note">{texts.note}</FieldLabel>
        <Textarea id="note" name="note" defaultValue={state?.values.note} key={`note-${kept}`} />
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.submit}
      </Button>
    </form>
  );
}
