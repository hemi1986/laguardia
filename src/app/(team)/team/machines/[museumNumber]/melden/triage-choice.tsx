import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages } from "@/platform/messages";

const { reportAndTriage: texts, triage, link, terms } = teamMessages;

/**
 * What a technician sees instead of the plain report form (ST-023, ST-052, G21a): the triage outcomes to choose from,
 * one button each, in the order of the triage page – „Mit Defekt verknüpfen“ (only with open defects; otherwise the
 * page says that there are none, G7), „Defekt erfassen“, „Direkt behoben“. A technician's own problem report is
 * triaged in the same step, so nothing can be sent from here.
 */
export function TriageChoice({
  museumNumber,
  machineModelTitle,
  canLink = false,
  triageRequired = false,
}: {
  museumNumber: string;
  machineModelTitle: string;
  /** Whether the machine has an open defect to link to. */
  canLink?: boolean;
  /** Just back from a plain report form sent without a triage outcome – a page loaded before (ST-023). */
  triageRequired?: boolean;
}) {
  const melden = `/team/machines/${encodeURIComponent(museumNumber)}/melden`;
  const outcomes = [
    ...(canLink ? [{ href: "mit-defekt-verknuepfen", label: link.outcome }] : []),
    { href: "defekt-erfassen", label: triage.recordDefect },
    { href: "direkt-behoben", label: terms["Resolved on the spot"] },
  ];
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
          {outcomes.map((outcome) => (
            <Link
              key={outcome.href}
              href={`${melden}/${outcome.href}`}
              className={buttonVariants({ variant: "outline" })}
            >
              {outcome.label}
            </Link>
          ))}
        </div>
        {/* Linking is not offered without an open defect – said in words, not left out silently (G7). */}
        {!canLink && <p className="text-muted-foreground text-sm">{link.noOpenDefects(museumNumber)}</p>}
      </section>
    </>
  );
}
