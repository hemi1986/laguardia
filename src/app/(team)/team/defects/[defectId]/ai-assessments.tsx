import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { teamMessages } from "@/platform/messages";
import { AiAssessmentPhotos } from "../../team-photos";
import { AiAssessmentContent, AiAssessmentFolds } from "../../ai-assessment-view";
import type { DefectAiAssessmentsData } from "./defect-details-data";
import { RetryAiAssessmentForm } from "./ki-einschaetzung/retry-ai-assessment-form";
import type { RetryAiAssessmentState } from "./ki-einschaetzung/retry-ai-assessment-definition";

const { aiAssessments: texts } = teamMessages;

/**
 * The section „KI-Einschätzungen“ on a defect's page (ST-107, RM-DefectAiAssessments): right below the defect's
 * actions, above its problem reports and work log entries. It shows the newest AI assessment – being written, written
 * or failed – open, the earlier ones below it folded, the newest first (ST-111), and „KI-Einschätzung anfordern“ only
 * where the person may request it. While one is being written the page carries a meta refresh, which works without
 * JavaScript too. With none and AI off the section is not shown.
 */
export function AiAssessmentsSection({
  data,
  requestHref,
  retryAction,
}: {
  data: DefectAiAssessmentsData;
  /** The request form's page – bound by the defect's page. */
  requestHref: string;
  /** „Erneut versuchen“ for a failed AI assessment (ST-108) – none where the page is only looked at. */
  retryAction?: (previous: RetryAiAssessmentState, formData: FormData) => Promise<RetryAiAssessmentState>;
}) {
  if (!data.shown) return null;
  const current = data.current;
  return (
    <Section title={texts.title}>
      {/* The page refreshes itself until the AI assessment is written – a meta refresh needs no JavaScript (G35). */}
      {current?.state === "requested" && <meta httpEquiv="refresh" content="5" />}
      {current?.state === "requested" ? (
        <div className="flex flex-col gap-3 [overflow-wrap:anywhere]">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{texts.running}</p>
            <p className="text-muted-foreground text-sm">{texts.runningHint}</p>
          </div>
          {current.note && <p className="text-sm whitespace-pre-line">{current.note}</p>}
          <AiAssessmentPhotos photos={current.photos} />
        </div>
      ) : current ? (
        <div className="flex flex-col gap-3">
          <AiAssessmentContent
            assessment={current}
            afterFailure={retryAction && <RetryAiAssessmentForm action={retryAction} offered={data.mayRequest} />}
          />
          {current.state !== "failed" && <RequestLink href={requestHref} offered={data.mayRequest} />}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{texts.empty}</p>
          <RequestLink href={requestHref} offered={data.mayRequest} />
        </div>
      )}
      <AiAssessmentFolds assessments={data.earlier} />
    </Section>
  );
}

function RequestLink({ href, offered }: { href: string; offered: boolean }) {
  if (!offered) return null;
  return (
    <Link href={href} className={buttonVariants({ variant: "outline", className: "self-start" })}>
      {texts.request}
    </Link>
  );
}
