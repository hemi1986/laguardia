import Link from "next/link";
import type { ReactNode } from "react";
import { teamMessages } from "@/platform/messages";
import { calendarDate, formatCalendarDate, formatDateTime } from "@/platform/time";
import type { ShownAiAssessmentData } from "./ai-assessment-data";
import { AiAssessmentPhotos } from "./team-photos";

const { aiAssessments: texts } = teamMessages;

/** How a cost is written for the team: German decimal comma, at least cents – e.g. "0,04 $". */
const costFormat = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/**
 * A written or failed AI assessment (ST-107, ST-108): what it found – summary, probable causes, what to check first,
 * references – or why it failed, then the note and photos of its request and the line that says it is AI, with the
 * chat model, when, who asked and the cost. `afterFailure` is what follows a failure's reason – „Erneut versuchen“ on the
 * newest one only. Texts are plain text: React escapes them.
 */
export function AiAssessmentContent({
  assessment,
  afterFailure,
}: {
  assessment: ShownAiAssessmentData;
  afterFailure?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 [overflow-wrap:anywhere]">
      {assessment.state === "written" ? (
        <>
          <div>
            <h3 className="text-sm font-medium">{texts.summary}</h3>
            <p className="text-sm whitespace-pre-line">{assessment.summary}</p>
          </div>
          {assessment.probableCauses && assessment.probableCauses.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">{texts.probableCauses}</h3>
              <ol className="list-decimal pl-5 text-sm">
                {assessment.probableCauses.map((cause, index) => (
                  <li key={index}>{cause}</li>
                ))}
              </ol>
            </div>
          )}
          {assessment.whatToCheckFirst && assessment.whatToCheckFirst.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">{texts.whatToCheckFirst}</h3>
              <ol className="list-decimal pl-5 text-sm">
                {assessment.whatToCheckFirst.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          )}
          {assessment.references.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">{texts.references}</h3>
              <ul className="list-disc pl-5 text-sm">
                {assessment.references.map((reference) => (
                  <li key={`${reference.fileId}-${reference.page ?? ""}`}>
                    {reference.removed ? (
                      referenceLabel(reference.title, reference.page)
                    ) : (
                      <Link href={`/team/dateien/${reference.fileId}`} className="underline">
                        {referenceLabel(reference.title, reference.page)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm font-medium">
            {texts.failed(assessment.failureReason ? texts.failureReasons[assessment.failureReason] : "")}
          </p>
          {afterFailure}
        </>
      )}
      {assessment.note && <p className="text-sm whitespace-pre-line">{assessment.note}</p>}
      <AiAssessmentPhotos photos={assessment.photos} />
      <p className="text-muted-foreground text-sm">
        {texts.line(
          assessment.chatModelName ?? assessment.chatModel,
          formatDateTime(assessment.changedAt ?? assessment.requestedAt),
          assessment.requestedByName,
          `${costFormat.format(assessment.cost ?? 0)} $`,
        )}
      </p>
    </div>
  );
}

/**
 * An earlier AI assessment, folded (ST-111, G39): a native `<details>` with the look of every fold (G31), so it opens
 * without JavaScript, headed „KI-Einschätzung vom 31.10.2026“ – the Berlin day it was written or failed.
 */
export function AiAssessmentFold({ assessment }: { assessment: ShownAiAssessmentData }) {
  return (
    <details>
      <summary className="fold text-sm font-medium underline-offset-4 hover:underline">
        {texts.earlier(formatCalendarDate(calendarDate(assessment.changedAt ?? assessment.requestedAt)))}
      </summary>
      <div className="mt-3 pl-4">
        <AiAssessmentContent assessment={assessment} />
      </div>
    </details>
  );
}

/** Earlier AI assessments, the newest first, each folded – nothing when there are none. */
export function AiAssessmentFolds({ assessments }: { assessments: ShownAiAssessmentData[] }) {
  if (assessments.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {assessments.map((assessment) => (
        <li key={assessment.id}>
          <AiAssessmentFold assessment={assessment} />
        </li>
      ))}
    </ul>
  );
}

function referenceLabel(title: string, page: number | undefined): string {
  return page ? texts.referenceWithPage(title, page) : title;
}
