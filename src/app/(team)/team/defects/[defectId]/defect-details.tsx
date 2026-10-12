import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import { defectActions, type DefectAction } from "@/modules/repair";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { reporterName } from "../../reporter";
import { claimantName, claimantText } from "../../claimant";
import type { ClaimDefectState, ReleaseClaimState } from "./actions";
import { DefectButtonForm } from "./defect-button-form";
import { ManageDefect } from "./manage-defect";
import type { DefectDetailsData } from "./defect-details-data";
import { ProblemReportPhoto } from "../../problem-report-photo";

const { defects: texts, recordDefect, terms } = teamMessages;

/** The actions with a form page of their own (G21): where it is and what its button says (G14). */
const formPages: Record<Exclude<DefectAction, "claim" | "release">, { path: string; label: string }> = {
  "log-work": { path: "arbeitsschritt", label: texts.logWork },
  resolve: { path: "beheben", label: texts.resolve },
  assign: { path: "zuweisen", label: texts.assign },
};

/** The work on a defect, offered as buttons under its header – the rest is behind „Verwalten“ (G22). */
const work = ["claim", "release", "log-work", "resolve"] as const satisfies readonly DefectAction[];

/** What the page says to who just did it (G3). */
const confirmations: Record<DefectAction, (title: string, assignedTo: string) => string> = {
  claim: texts.claimed,
  release: texts.released,
  "log-work": texts.workLogged,
  resolve: texts.resolved,
  assign: texts.assigned,
};

/**
 * A defect's own page (ST-021): its machine – leading to the machine record –, title, priority, whether it is suitable
 * for helpers, how long it is open and who has claimed it – with the buttons to claim it or take it over (ST-025), to
 * release one's own claim in the same place (ST-026) and to resolve it (ST-028, G21), then for technicians the fold
 * „Verwalten“ with assigning it and releasing someone else's claim (ST-026, G22) –, for a resolved defect how it ended (closing note, by whom, when), then
 * the problem reports it came from: the originating one first, then the
 * linked ones (ST-022). Before them its work log, the newest entry first, with the button to log work (ST-024, G21).
 * Texts are plain text.
 */
export function DefectDetailsView({
  details,
  claimAction,
  releaseAction,
}: {
  details: DefectDetailsData | undefined;
  /** CMD-ClaimDefect for this defect (ST-025) – none where the page is only looked at (e.g. a test of its data). */
  claimAction?: (previous: ClaimDefectState, formData: FormData) => Promise<ClaimDefectState>;
  /** CMD-ReleaseClaim for this defect (ST-026) – none where the page is only looked at. */
  releaseAction?: (previous: ReleaseClaimState, formData: FormData) => Promise<ReleaseClaimState>;
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
      {/* Only who just did it is told so – the address alone cannot make the page say it (G3). */}
      {details.confirmed && (
        <Confirmation>
          {confirmations[details.confirmed.action](details.title, details.confirmed.assignedTo ?? "")}
          {details.confirmed.takenOverFrom && texts.takenOverFrom(details.confirmed.takenOverFrom)}
        </Confirmation>
      )}
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
        {details.claimant && (
          <p className="text-sm">
            {claimantText(details.claimant)}
            {details.assignedBy &&
              ` · ${details.assignedBy.you ? texts.assignedByYou : texts.assignedBy(claimantName(details.assignedBy))}`}
          </p>
        )}
        {/* The work on the defect, in Repair's order – offered only to someone its command will not refuse (G11). */}
        {defectActions
          .filter((action) => work.some((workAction) => workAction === action))
          .map((action) =>
            action === "claim"
              ? claimAction && (
                  <DefectButtonForm
                    key={action}
                    action={claimAction}
                    version={details.version}
                    label={details.claimant ? texts.takeOverFrom(claimantName(details.claimant)) : texts.claim}
                    offered={details.offered.includes(action)}
                  />
                )
              : action === "release"
                ? // One's own claim is released where it was claimed; someone else's behind „Verwalten“ (G22).
                  releaseAction &&
                  details.claimant?.you && (
                    <DefectButtonForm
                      key={action}
                      action={releaseAction}
                      version={details.version}
                      label={texts.release}
                      offered={details.offered.includes(action)}
                      variant="outline"
                    />
                  )
                : action !== "assign" &&
                  details.offered.includes(action) && (
                    <Link
                      key={action}
                      href={`/team/defects/${details.id}/${formPages[action].path}`}
                      className={buttonVariants({ variant: "outline", className: "self-start" })}
                    >
                      {formPages[action].label}
                    </Link>
                  ),
          )}
        <ManageDefect
          assignHref={
            details.offered.includes("assign") ? `/team/defects/${details.id}/${formPages.assign.path}` : undefined
          }
          release={
            releaseAction && details.claimant && !details.claimant.you
              ? {
                  action: releaseAction,
                  version: details.version,
                  label: texts.releaseClaimOf(claimantName(details.claimant)),
                  offered: details.offered.includes("release"),
                }
              : undefined
          }
        />
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
