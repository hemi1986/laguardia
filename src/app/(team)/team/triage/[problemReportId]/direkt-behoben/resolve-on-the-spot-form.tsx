"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import { teamMessages } from "@/platform/messages";
import type { ResolveOnTheSpotState } from "./actions";
import { triageRejectionText } from "../triage-rejection-text";

const { resolveOnTheSpot: texts, triage } = teamMessages;

/**
 * The form „Direkt behoben“ (ST-019, story review 2026-10-03): only the note, labelled „Was wurde gemacht?“. It records
 * a fact and asks nothing else. A rejection keeps the note and marks its field when the note is the reason (G8), with
 * and without JavaScript. A problem report that was already triaged when the page loaded shows no form – but one
 * triaged while the person typed keeps the form, the note and the rejection.
 */
export function ResolveOnTheSpotForm({
  action: resolve,
  version,
  triaged,
}: {
  action: (previous: ResolveOnTheSpotState, formData: FormData) => Promise<ResolveOnTheSpotState>;
  version: number;
  triaged: boolean;
}) {
  const [state, action, pending] = useActionState(resolve, null);
  const rejectionId = useId();
  if (triaged && !state) return <p>{triage.alreadyTriaged}</p>;
  const kept = state ? JSON.stringify(state) : "empty";
  const invalid = state?.error === "note-required";

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="version" value={version} />
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="note">{texts.note}</FieldLabel>
        <Textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={state?.values.note}
          key={`note-${kept}`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? rejectionId : undefined}
        />
      </Field>
      {state && (
        <div id={rejectionId} className="flex flex-col gap-2">
          <Rejection>{triageRejectionText(state)}</Rejection>
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
