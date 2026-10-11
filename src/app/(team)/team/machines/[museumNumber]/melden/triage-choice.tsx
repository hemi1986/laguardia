import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages } from "@/platform/messages";

const { reportAndRecordDefect: texts, triage } = teamMessages;

/**
 * What a technician sees instead of the plain report form (ST-023, G21a): the triage outcomes to choose from, one
 * button each – a technician's own problem report is triaged in the same step, so nothing can be sent from here.
 * ST-023 offers *record a defect*; ST-052 adds linking before it and resolving on the spot after it.
 */
export function TriageChoice({
  museumNumber,
  machineModelTitle,
  triageRequired = false,
}: {
  museumNumber: string;
  machineModelTitle: string;
  /** Just back from a plain report form sent without a triage outcome – a page loaded before (ST-023). */
  triageRequired?: boolean;
}) {
  return (
    <>
      <p className="text-muted-foreground text-sm">
        {museumNumber} · {machineModelTitle}
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{texts.triage}</h2>
        <p className="text-sm">{texts.triagedWhenReporting}</p>
        {triageRequired && <Rejection>{commandErrorText(teamMessages, "triage-required")}</Rejection>}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/team/machines/${encodeURIComponent(museumNumber)}/melden/defekt-erfassen`}
            className={buttonVariants({ variant: "outline" })}
          >
            {triage.recordDefect}
          </Link>
        </div>
      </section>
    </>
  );
}
