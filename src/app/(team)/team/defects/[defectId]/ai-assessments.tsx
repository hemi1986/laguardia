import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { AiAssessmentPhotos } from "../../team-photos";
import type { DefectAiAssessmentsData } from "./defect-details-data";

const { aiAssessments: texts } = teamMessages;

/** How a cost is written for the team: German decimal comma, at least cents – e.g. "0,04 $". */
const costFormat = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/**
 * The section „KI-Einschätzungen“ on a defect's page (ST-107, RM-DefectAiAssessments): right below the defect's
 * actions, above its problem reports and work log entries. It shows the newest AI assessment – being written, written
 * or failed – and „KI-Einschätzung anfordern“ only where the person may request it. While one is being written the
 * page carries a meta refresh, which works without JavaScript too. With none and AI off the section is not shown.
 */
export function AiAssessmentsSection({
  data,
  requestHref,
}: {
  data: DefectAiAssessmentsData;
  /** The request form's page – bound by the defect's page. */
  requestHref: string;
}) {
  if (!data.shown) return null;
  const current = data.current;
  return (
    <Section title={texts.title}>
      {/* The page refreshes itself until the AI assessment is written – a meta refresh needs no JavaScript (G35). */}
      {current?.state === "requested" && <meta httpEquiv="refresh" content="5" />}
      {current?.state === "requested" ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{texts.running}</p>
          <p className="text-muted-foreground text-sm">{texts.runningHint}</p>
          <RequestLink href={requestHref} offered={false} />
        </div>
      ) : current ? (
        <div className="flex flex-col gap-3 [overflow-wrap:anywhere]">
          {current.state === "written" ? (
            <>
              <div>
                <h3 className="text-sm font-medium">{texts.summary}</h3>
                <p className="text-sm whitespace-pre-line">{current.summary}</p>
              </div>
              {current.probableCauses && current.probableCauses.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium">{texts.probableCauses}</h3>
                  <ol className="list-decimal pl-5 text-sm">
                    {current.probableCauses.map((cause, index) => (
                      <li key={index}>{cause}</li>
                    ))}
                  </ol>
                </div>
              )}
              {current.whatToCheckFirst && current.whatToCheckFirst.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium">{texts.whatToCheckFirst}</h3>
                  <ol className="list-decimal pl-5 text-sm">
                    {current.whatToCheckFirst.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              {current.references.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium">{texts.references}</h3>
                  <ul className="list-disc pl-5 text-sm">
                    {current.references.map((reference) => (
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
            <p className="text-sm font-medium">
              {texts.failed(current.failureReason ? texts.failureReasons[current.failureReason] : "")}
            </p>
          )}
          {current.note && <p className="text-sm whitespace-pre-line">{current.note}</p>}
          <AiAssessmentPhotos photos={current.photos} />
          <p className="text-muted-foreground text-sm">
            {texts.line(
              current.chatModelName ?? current.chatModel,
              current.changedAt ? formatDateTime(current.changedAt) : formatDateTime(current.requestedAt),
              current.requestedByName,
              `${costFormat.format(current.cost ?? 0)} $`,
            )}
          </p>
          <RequestLink href={requestHref} offered={data.mayRequest} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{texts.empty}</p>
          <RequestLink href={requestHref} offered={data.mayRequest} />
        </div>
      )}
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

function referenceLabel(title: string, page: number | undefined): string {
  return page ? texts.referenceWithPage(title, page) : title;
}
