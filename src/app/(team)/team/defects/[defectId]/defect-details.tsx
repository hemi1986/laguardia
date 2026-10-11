import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { reporterName } from "../../reporter";
import { claimantName, claimantText } from "../../claimant";
import type { ClaimDefectState } from "./actions";
import { ClaimDefectForm } from "./claim-defect-form";
import type { DefectDetailsData } from "./defect-details-data";
import { ProblemReportPhoto } from "../../problem-report-photo";

const { defects: texts, recordDefect, terms } = teamMessages;

/**
 * A defect's own page (ST-021): its machine – leading to the machine record –, title, priority, whether it is suitable
 * for helpers, how long it is open and who has claimed it – with the buttons to claim it or take it over (ST-025) and to
 * resolve it (ST-028, G21) –, for a resolved defect how it ended (closing note, by whom, when), then
 * the problem reports it came from: the originating one first, then the
 * linked ones (ST-022). Before them its work log, the newest entry first, with the button to log work (ST-024, G21).
 * Texts are plain text.
 */
export function DefectDetailsView({
  details,
  claimAction,
  justClaimed = false,
  justResolved = false,
  justLoggedWork = false,
}: {
  details: DefectDetailsData | undefined;
  /** CMD-ClaimDefect for this defect (ST-025) – none where the page is only looked at (e.g. a test of its data). */
  claimAction?: (previous: ClaimDefectState, formData: FormData) => Promise<ClaimDefectState>;
  /** Just back from claiming: the confirmation names the defect and whom it was taken over from (G3). */
  justClaimed?: boolean;
  /** Just back from resolving: the confirmation names the defect (G3). */
  justResolved?: boolean;
  /** Just back from logging work: the confirmation names the defect (G3). */
  justLoggedWork?: boolean;
}) {
  if (!details) {
    return (
      <div className="flex flex-col gap-2">
        <p>{texts.unknown}</p>
        <Link href="/team/defects" className="self-start underline underline-offset-4">
          {texts.back}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6 [overflow-wrap:anywhere]">
      {/* Only the claimant is told so – the address alone cannot make the page say it. */}
      {justClaimed && details.claimant?.you && (
        <Confirmation>
          {texts.claimed(details.title)}
          {details.takenOverFrom && texts.takenOverFrom(details.takenOverFrom)}
        </Confirmation>
      )}
      {/* Only who resolved it is told so – the address alone cannot make the page say it. */}
      {justResolved && details.resolution?.you && <Confirmation>{texts.resolved(details.title)}</Confirmation>}
      {justLoggedWork && details.youLoggedLast && <Confirmation>{texts.workLogged(details.title)}</Confirmation>}
      <section className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{details.title}</h2>
        <Link
          href={`/team/machines/${encodeURIComponent(details.museumNumber)}`}
          className="self-start underline underline-offset-4"
        >
          {details.museumNumber} · {details.machineModelTitle}
        </Link>
        <p className="text-sm">{texts.priority(recordDefect.priorities[details.priority])}</p>
        <p className="text-sm">
          {details.suitableForHelpers ? terms["Suitable for helpers"] : texts.notSuitableForHelpers}
        </p>
        <p className="text-muted-foreground text-sm">
          {texts.recordedAt(formatDateTime(details.recordedAt))}
          {details.openDays !== undefined && ` · ${texts.openFor(details.openDays)}`}
        </p>
        {details.claimant && <p className="text-sm">{claimantText(details.claimant)}</p>}
        {claimAction && (
          <ClaimDefectForm
            action={claimAction}
            version={details.version}
            label={details.claimant ? texts.takeOverFrom(claimantName(details.claimant)) : texts.claim}
            offered={details.canClaim}
          />
        )}
        {details.canLogWork && (
          <Link
            href={`/team/defects/${details.id}/arbeitsschritt`}
            className={buttonVariants({ variant: "outline", className: "self-start" })}
          >
            {texts.logWork}
          </Link>
        )}
        {details.canResolve && (
          <Link
            href={`/team/defects/${details.id}/beheben`}
            className={buttonVariants({ variant: "outline", className: "self-start" })}
          >
            {texts.resolve}
          </Link>
        )}
      </section>
      {details.resolution && (
        <section className="flex flex-col gap-1">
          <h2 className="font-semibold">{terms["Closing note"]}</h2>
          <p className="whitespace-pre-line">{details.resolution.closingNote}</p>
          <p className="text-muted-foreground text-sm">
            {texts.resolvedBy(details.resolution.resolvedBy, formatDateTime(details.resolution.resolvedAt))}
          </p>
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{texts.workLog}</h2>
        {details.workLog.length === 0 ? (
          <p className="text-muted-foreground text-sm">{texts.noWorkLogged}</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {details.workLog.map((entry) => (
              <li key={entry.id}>
                <article className="flex flex-col gap-1 text-sm">
                  <p className="whitespace-pre-line">{entry.whatWasDone}</p>
                  {entry.partsUsed && <p className="whitespace-pre-line">{texts.partsUsedLine(entry.partsUsed)}</p>}
                  <p className="text-muted-foreground">
                    {entry.loggedBy} · {formatDateTime(entry.loggedAt)}
                  </p>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{texts.problemReports}</h2>
        <ol className="flex flex-col gap-4">
          {details.problemReports.map((report) => (
            <li key={report.id}>
              <article className="flex flex-col gap-1 text-sm">
                <p className="font-medium">{report.originating ? texts.originating : texts.linked}</p>
                <p>{report.description}</p>
                {report.photo && <ProblemReportPhoto address={report.photo.address} />}
                <p className="text-muted-foreground">
                  {reporterName(report.reporter)} · {formatDateTime(report.reportedAt)}
                </p>
              </article>
            </li>
          ))}
        </ol>
      </section>
      <Link href="/team/defects" className="self-start underline underline-offset-4">
        {texts.back}
      </Link>
    </div>
  );
}
