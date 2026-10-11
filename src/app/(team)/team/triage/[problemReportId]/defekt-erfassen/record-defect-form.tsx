"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import type { MachineStatus } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";
import type { RecordDefectState } from "./actions";
import { DefectFields } from "./defect-fields";
import type { RecordDefectField } from "./record-defect-input";
import { rejectionText } from "./record-defect-rejection-text";

const { recordDefect: texts, triage } = teamMessages;

type ErrorCode = NonNullable<RecordDefectState>["error"];

/** The field that caused a rejection – marked at the form (G8). */
const fieldOf: Partial<Record<ErrorCode, RecordDefectField>> = {
  "title-required": "title",
  "machine-status-not-stricter": "machineStatus",
};

/**
 * The form „Defekt erfassen“ (ST-018, story review 2026-10-03): title, priority (normal preselected), the mark for
 * helpers and – only when there is a stricter one – the machine status in the same step, „Status nicht ändern“
 * preselected. There is no reason field: the status history's reason is the defect's title. A rejection keeps every
 * choice and marks the field (G8), with and without JavaScript. A problem report that was already triaged when the
 * page loaded shows no form – but one triaged while the technician typed keeps the form, the input and the rejection.
 */
export function RecordDefectForm({
  action: record,
  version,
  triaged,
  museumNumber,
  machine,
}: {
  action: (previous: RecordDefectState, formData: FormData) => Promise<RecordDefectState>;
  version: number;
  triaged: boolean;
  museumNumber: string;
  machine: { status: MachineStatus; version: number; stricter: MachineStatus[] };
}) {
  const [state, action, pending] = useActionState(record, null);
  const rejectionId = useId();
  if (triaged && !state) return <p>{triage.alreadyTriaged}</p>;
  const kept = state ? JSON.stringify(state) : "empty";
  const invalid = state ? fieldOf[state.error] : undefined;
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="version" value={version} />
      <DefectFields
        values={state?.values}
        kept={kept}
        invalid={invalid}
        rejectionId={rejectionId}
        museumNumber={museumNumber}
        machine={machine}
      />
      {state && (
        <div id={rejectionId} className="flex flex-col gap-2">
          <Rejection>{rejectionText(state, museumNumber)}</Rejection>
          {state.error === "already-triaged" && (
            <Link href="/team/triage" className="self-start text-sm underline underline-offset-4">
              {triage.back}
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
