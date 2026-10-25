"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import type { DefectsToLinkTo } from "@/modules/repair";
import { DefectsToLinkToField } from "../../../../defects-to-link-to";
import { rejectionText } from "../report-and-triage-rejection-text";
import { isAboutDescription, ReportSection } from "../report-section";
import type { ReportAndLinkState } from "./actions";
import { keptKey } from "@/app/_actions/form-parts";

const { reportAndLink: texts, link, reportProblem } = teamMessages;

/**
 * The form „Problem melden und mit Defekt verknüpfen“ (ST-052, G21a): the problem report – description and an optional
 * photo – and the machine's open and recently resolved defects as on „Mit Defekt verknüpfen“ (ST-022, ST-053) – no status
 * choice here (user, 2026-10-25). Sent once and stored together. A rejection keeps what was typed
 * and the chosen defect, if it is still offered (G8), with and without JavaScript; the photo cannot be kept, so the
 * rejection says when it must be chosen again (G8a). Without open defects, or for a machine already retired when the
 * page loaded, there is no form – the page says why (G7); after a rejection the form stays.
 */
export function ReportAndLinkForm({
  action: report,
  museumNumber,
  retired,
  defects,
}: {
  action: (previous: ReportAndLinkState, formData: FormData) => Promise<ReportAndLinkState>;
  museumNumber: string;
  retired: boolean;
  /** Open and recently resolved defects (ST-053) – linking a resolved one reopens it. */
  defects: DefectsToLinkTo;
}) {
  const [state, action, pending] = useActionState(report, null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const rejectionId = useId();
  if (retired && !state) return <p>{reportProblem.retired}</p>;
  const nothingToLinkTo = defects.open.length + defects.recentlyResolved.length === 0;
  if (nothingToLinkTo && !state) return <p>{link.noOpenDefects(museumNumber)}</p>;
  const kept = keptKey(state);
  const defectInvalid =
    state?.error === "defect-required" ||
    state?.error === "defect-not-open" ||
    state?.error === "defect-resolved-too-long-ago";

  return (
    <form action={action} className="flex flex-col gap-8">
      <ReportSection
        description={state?.values.description}
        kept={kept}
        invalid={isAboutDescription(state?.error)}
        rejectionId={rejectionId}
        onPreparingPhoto={setPreparingPhoto}
      />
      <section className="flex flex-col gap-5">
        <h2 className="font-medium">{teamMessages.terms.Defect}</h2>
        {/* After a rejection the form stays – also when nothing is left to link to: said in words (G7). */}
        {nothingToLinkTo && <p className="text-sm">{link.noOpenDefects(museumNumber)}</p>}
        <DefectsToLinkToField
          defects={defects}
          value={state?.values.defectId}
          kept={kept}
          invalid={defectInvalid}
          describedBy={defectInvalid ? rejectionId : undefined}
        />
      </section>
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state, museumNumber)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending || preparingPhoto}>
        {texts.submit}
      </Button>
    </form>
  );
}
