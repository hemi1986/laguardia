"use client";

import { useActionState, useId } from "react";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import type { ChangeDefectDetailsState } from "./actions";

const { defects: texts, recordDefect } = teamMessages;

/** The rejections that are about the title – marked at the field (G8). */
const aboutTheTitle: readonly TeamCommandErrorCode[] = ["title-required"];

/**
 * The form „Titel und Eignung ändern“ (ST-031): the title – with the hint of ST-018's form, since visitors see it – and
 * the mark for helpers, both as they are now. While a helper holds the claim, the form says beside the mark that
 * removing it releases that claim. A rejection keeps what was typed and marks the title when it is the reason (G8).
 * Someone who could not change the defect when the page loaded sees the reason instead of a form – but a defect that
 * changed while they typed keeps the form and the rejection.
 */
export function ChangeDefectDetailsForm({
  action: change,
  version,
  title,
  suitableForHelpers,
  releasesClaimOf,
  whyNot,
}: {
  action: (previous: ChangeDefectDetailsState, formData: FormData) => Promise<ChangeDefectDetailsState>;
  version: number;
  title: string;
  suitableForHelpers: boolean;
  /** Whose claim removing the mark releases, by name – none when it releases nobody's. */
  releasesClaimOf: string | undefined;
  /** Why the team member may not change the defect as it is now – CMD-ChangeDefectDetails's own reason (G11). */
  whyNot: TeamCommandErrorCode | undefined;
}) {
  const [state, action, pending] = useActionState(change, null);
  const rejectionId = useId();
  if (whyNot && !state) return <p>{commandErrorText(teamMessages, whyNot)}</p>;
  const invalid = !!state && aboutTheTitle.includes(state.error);

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="title">{recordDefect.defectTitle}</FieldLabel>
        <Input
          id="title"
          name="title"
          defaultValue={state ? state.values.title : title}
          key={`title-${keptKey(state)}`}
          aria-invalid={invalid || undefined}
          aria-describedby={["title-hint", invalid ? rejectionId : undefined].filter(Boolean).join(" ")}
        />
        <FieldDescription id="title-hint">{recordDefect.titleHint}</FieldDescription>
      </Field>
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="suitableForHelpers"
            defaultChecked={state ? state.values.suitableForHelpers !== "" : suitableForHelpers}
            key={`suitableForHelpers-${keptKey(state)}`}
            aria-describedby={releasesClaimOf ? "releases-claim" : undefined}
            className="size-4"
          />
          {recordDefect.suitableForHelpers}
        </label>
        {releasesClaimOf && (
          <p id="releases-claim" className="text-muted-foreground text-sm">
            {texts.removingMarkReleases(releasesClaimOf)}
          </p>
        )}
      </div>
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.changeDetailsSubmit}
      </Button>
    </form>
  );
}
