import Link from "next/link";
import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import { Section } from "@/components/ui/section";
import { defectActions, type DefectAction, type DefectRepairTimes } from "@/modules/repair";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { MachineLink } from "../../machine-link";
import { reporterName } from "../../reporter";
import { claimantText } from "../../claimant";
import type { ClaimDefectState, ReleaseClaimState, ResumeDefectState } from "./actions";
import { DefectButtonForm } from "./defect-button-form";
import { ManageDefect } from "./manage-defect";
import { defectActionPages, defectFormAddress } from "./defect-action-pages";
import type { DefectDetailsData } from "./defect-details-data";
import { AiAssessmentsSection } from "./ai-assessments";
import type { RetryAiAssessmentState } from "./ki-einschaetzung/retry-ai-assessment-definition";
import { ProblemReportPhoto, WorkLogPhotos } from "../../team-photos";

const { defects: texts, recordDefect, terms, machineRecord, machines } = teamMessages;

/** The work on a defect, offered as buttons under its header – the rest is behind „Verwalten“ (G22). */
const work = [
  "claim",
  "release",
  "log-work",
  "put-on-hold",
  "resume",
  "resolve",
] as const satisfies readonly DefectAction[];

/**
 * A defect's own page (ST-021): its machine – leading to the machine record –, title, priority, whether it is suitable
 * for helpers, how long it is open and who has claimed it – with the buttons to claim it or take it over (ST-025), to
 * release one's own claim in the same place (ST-026) and to resolve it (ST-028, G21), then for technicians the fold
 * „Verwalten“ with assigning it, releasing someone else's claim (ST-026, G22) and changing its priority (ST-027) –, for a resolved defect how it ended (closing note, by whom, when), then
 * the problem reports it came from: the originating one first, then the
 * linked ones (ST-022). Before them its work log, the newest entry first, with the button to log work (ST-024, G21).
 * Texts are plain text.
 */
export function DefectDetailsView({
  details,
  claimAction,
  releaseAction,
  resumeAction,
  retryAiAssessmentAction,
}: {
  details: DefectDetailsData | undefined;
  /** CMD-ClaimDefect for this defect (ST-025) – none where the page is only looked at (e.g. a test of its data). */
  claimAction?: (previous: ClaimDefectState, formData: FormData) => Promise<ClaimDefectState>;
  /** CMD-ReleaseClaim for this defect (ST-026) – none where the page is only looked at. */
  releaseAction?: (previous: ReleaseClaimState, formData: FormData) => Promise<ReleaseClaimState>;
  /** CMD-ResumeDefect for this defect (ST-029) – one tap, in the place of „Pausieren“; none where the page is only looked at. */
  resumeAction?: (previous: ResumeDefectState, formData: FormData) => Promise<ResumeDefectState>;
  /** „Erneut versuchen“ for a failed AI assessment (ST-108) – none where the page is only looked at. */
  retryAiAssessmentAction?: (previous: RetryAiAssessmentState, formData: FormData) => Promise<RetryAiAssessmentState>;
}) {
  if (!details) {
    return (
      <Page title={terms.Defect}>
        <p>{texts.unknown}</p>
        <BackLink href="/team/defects">{texts.back}</BackLink>
      </Page>
    );
  }
  // Headed by the defect's title, like every other record (ST-092, G1).
  return (
    <Page title={details.title}>
      {/* Only who just did it is told so – the address alone cannot make the page say it (G3). */}
      {details.confirmed && (
        <div className="[overflow-wrap:anywhere]">
          <Confirmation>
            {defectActionPages[details.confirmed.action].confirmation(details.title, {
              assignedTo: details.confirmed.assignedTo ?? "",
              priority: recordDefect.priorities[details.priority],
              holdReason: details.hold ? texts.holdReasons[details.hold.reason] : "",
              suitableForHelpers: details.suitableForHelpers,
              changedDetails: details.confirmed.changedDetails,
            })}
            {details.confirmed.takenOverFrom && texts.takenOverFrom(details.confirmed.takenOverFrom)}
            {details.confirmed.newMachineStatus &&
              ` ${machineRecord.statusChanged(details.museumNumber, machines.statuses[details.confirmed.newMachineStatus])}`}
          </Confirmation>
        </div>
      )}
      {/* The header – the page is headed by the defect's title (G1), its machine the link right under it. */}
      <div className="flex flex-col gap-1 [overflow-wrap:anywhere]">
        <MachineLink museumNumber={details.museumNumber} machineModelTitle={details.machineModelTitle} />
        <p className="text-sm">{texts.priority(recordDefect.priorities[details.priority])}</p>
        <p className="text-sm">
          {details.suitableForHelpers ? terms["Suitable for helpers"] : texts.notSuitableForHelpers}
        </p>
        <p className="text-muted-foreground text-sm">
          {texts.recordedAt(formatDateTime(details.recordedAt))}
          {details.openDays !== undefined && ` · ${texts.openFor(details.openDays)}`}
        </p>
        <RepairTimesLine times={details.repairTimes} />
        {details.hold && (
          <p className="text-sm font-medium">
            {texts.onHold(texts.holdReasons[details.hold.reason])}
            {details.hold.note && ` · ${details.hold.note}`}
          </p>
        )}
        {details.claimant && (
          <p className="text-sm">
            {claimantText(details.claimant)}
            {details.assignedBy &&
              ` · ${details.assignedBy.you ? texts.assignedByYou : texts.assignedBy(details.assignedBy.name)}`}
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
                    label={details.claimant ? texts.takeOverFrom(details.claimant.name) : texts.claim}
                    offered={details.offered.includes(action)}
                  />
                )
              : action === "release"
                ? // One's own claim is released where it was claimed; someone else's behind „Verwalten“ (G22). The
                  // form stays when the claim is gone meanwhile, so its rejection is not lost.
                  releaseAction && (
                    <DefectButtonForm
                      key={action}
                      action={releaseAction}
                      version={details.version}
                      label={texts.release}
                      offered={details.offered.includes(action) && !!details.claimant?.you}
                      variant="outline"
                    />
                  )
                : action === "resume"
                  ? resumeAction && (
                      <DefectButtonForm
                        key={action}
                        action={resumeAction}
                        version={details.version}
                        label={texts.resume}
                        offered={details.offered.includes(action)}
                        variant="outline"
                      />
                    )
                  : work.some((workAction) => workAction === action) &&
                    details.offered.includes(action) && (
                      <Link
                        key={action}
                        href={defectFormAddress(details.id, action)}
                        className={buttonVariants({ variant: "outline", className: "self-start" })}
                      >
                        {defectActionPages[action].form.label}
                      </Link>
                    ),
          )}
        <ManageDefect
          assignHref={details.offered.includes("assign") ? defectFormAddress(details.id, "assign") : undefined}
          prioritizeHref={
            details.offered.includes("prioritize") ? defectFormAddress(details.id, "prioritize") : undefined
          }
          changeDetailsHref={
            details.offered.includes("change-details") ? defectFormAddress(details.id, "change-details") : undefined
          }
          release={
            releaseAction && {
              action: releaseAction,
              version: details.version,
              label: details.claimant ? texts.releaseClaimOf(details.claimant.name) : "",
              offered: details.offered.includes("release") && !!details.claimant && !details.claimant.you,
            }
          }
        />
      </div>
      {/* Right below the actions, above the records of what happened (ST-107, RM-DefectAiAssessments). */}
      <AiAssessmentsSection
        data={details.aiAssessments}
        requestHref={`/team/defects/${details.id}/ki-einschaetzung`}
        retryAction={retryAiAssessmentAction}
      />
      {/* How it ended each time and why it was reopened – each reopening after the closing note it followed (ST-030). */}
      {details.resolutionsAndReopenings.map((step, index, steps) => {
        // A resolved defect offers only reopening, at the end of its last closing note (G22, G29).
        const reopen = index === steps.length - 1 && details.offered.includes("reopen") && (
          <Link
            href={defectFormAddress(details.id, "reopen")}
            className={buttonVariants({ variant: "outline", className: "self-start" })}
          >
            {defectActionPages.reopen.form.label}
          </Link>
        );
        return step.kind === "resolution" ? (
          <Section key={step.id} title={terms["Closing note"]}>
            <p className="whitespace-pre-line">{step.closingNote}</p>
            <p className="text-muted-foreground text-sm">
              {texts.resolvedBy(step.resolvedBy, formatDateTime(step.resolvedAt))}
            </p>
            {reopen}
          </Section>
        ) : (
          <Section key={step.id} title={texts.reopenedBy(step.reopenedBy, formatDateTime(step.reopenedAt))}>
            <p className="whitespace-pre-line">
              {step.problemReport ? texts.reopenedBecauseOf(step.problemReport.description) : step.reason}
            </p>
            {reopen}
          </Section>
        );
      })}
      <Section title={texts.workLog}>
        {details.workLog.length === 0 ? (
          <p className="text-sm">{texts.noWorkLogged}</p>
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
                  <WorkLogPhotos photos={entry.photos} />
                </article>
              </li>
            ))}
          </ol>
        )}
      </Section>
      <Section title={texts.problemReports}>
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
      </Section>
      <BackLink href="/team/defects">{texts.back}</BackLink>
    </Page>
  );
}

/** The defect's two times (ST-051) in one line – a time that does not exist yet is left out, and so is the line. */
function RepairTimesLine({ times }: { times: DefectRepairTimes }) {
  const shown = [
    times.toFirstWorkLogEntry !== undefined &&
      texts.repairTime(terms["Time to first work log entry"], times.toFirstWorkLogEntry),
    times.toResolved !== undefined && texts.repairTime(terms["Time to resolved"], times.toResolved),
  ].filter((time) => time !== false);
  return shown.length > 0 && <p className="text-muted-foreground text-sm">{shown.join(" · ")}</p>;
}
