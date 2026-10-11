"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { PhotoField } from "../../../../../photo-field";
import type { TeamReportProblemState } from "./actions";
import { isAboutDescription } from "./report-section";
import { keptKey } from "@/app/_actions/form-parts";

const { reportProblem: texts } = teamMessages;

/**
 * The team's report form (ST-015) – what a helper sees: the description of the problem and an optional photo (ST-016),
 * and above them the way to reporting and resolving on the spot in the same step (ST-052). A rejection keeps it, names the reason above the
 * button and marks the field (G8), with and without JavaScript.
 */
export function TeamReportProblemForm({
  action: report,
  resolveOnTheSpot,
}: {
  action: (previous: TeamReportProblemState, formData: FormData) => Promise<TeamReportProblemState>;
  /** Where a problem already fixed is reported and resolved on the spot in the same step (ST-052, H2). */
  resolveOnTheSpot: string;
}) {
  const [state, action, pending] = useActionState(report, null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const rejectionId = useId();
  const kept = keptKey(state);
  const invalid = isAboutDescription(state?.error);

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* Above the description, so it is seen before anything is typed (story review 2026-10-10, H2). */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span>{teamMessages.reportAndTriage.alreadyResolved}</span>
        <Link href={resolveOnTheSpot} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {teamMessages.terms["Resolved on the spot"]}
        </Link>
      </div>
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="description">{texts.description}</FieldLabel>
        <Textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={state?.values.description}
          key={`description-${kept}`}
          aria-invalid={invalid || undefined}
          aria-describedby={["description-hint", invalid ? rejectionId : undefined].filter(Boolean).join(" ")}
        />
        <FieldDescription id="description-hint">{texts.descriptionHint}</FieldDescription>
      </Field>
      <PhotoField
        key={`photo-${kept}`}
        name="photo"
        texts={{
          ...texts.photo,
          tooLarge: teamMessages.commandErrors["too-large"],
          notAnImage: teamMessages.commandErrors["not-an-image"],
        }}
        onPreparing={setPreparingPhoto}
      />
      {state && (
        <div id={rejectionId}>
          <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending || preparingPhoto}>
        {texts.submit}
      </Button>
    </form>
  );
}
