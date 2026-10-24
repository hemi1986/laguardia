import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { teamMessages } from "@/platform/messages";

const { recordMaintenance: texts } = teamMessages;

type RecordField = "outcome" | "date" | "note";

/** The field a rejection of CMD-RecordMaintenance points at – marked at the form (G8). */
export const recordFieldOf: Partial<Record<string, RecordField>> = {
  "outcome-required": "outcome",
  "date-invalid": "date",
  "date-too-early": "date",
  "date-in-the-future": "date",
};

/**
 * Outcome, date and note of a maintenance record on shadcn's Field (G8, G9) – shared by „Wartung erfassen“ (ST-044)
 * and „Für mehrere Geräte erfassen“ (ST-045): the outcome as a native select, the date as a native date field – today
 * preselected, at most 7 days back –, an optional note; it works without JavaScript. Keyed on `kept`, so a rejection
 * keeps what was entered.
 */
export function MaintenanceRecordFields({
  values,
  invalid,
  kept,
  rejectionId,
  today,
  earliest,
}: {
  values: Partial<Record<RecordField, string>> | undefined;
  invalid: RecordField | undefined;
  kept: string;
  rejectionId: string;
  today: string;
  earliest: string;
}) {
  const marked = (field: RecordField, hint?: string) => {
    const describedBy = [hint, invalid === field ? rejectionId : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": invalid === field || undefined, "aria-describedby": describedBy || undefined };
  };
  return (
    <>
      <Field data-invalid={invalid === "outcome"}>
        <FieldLabel htmlFor="outcome">{texts.outcome}</FieldLabel>
        <NativeSelect
          id="outcome"
          name="outcome"
          defaultValue={values?.outcome ?? ""}
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
          defaultValue={values?.date ?? today}
          key={`date-${kept}`}
          {...marked("date", "date-hint")}
        />
        <FieldDescription id="date-hint">{texts.dateHint}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="note">{texts.note}</FieldLabel>
        <Textarea id="note" name="note" defaultValue={values?.note} key={`note-${kept}`} />
      </Field>
    </>
  );
}
