import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { teamMachinePage } from "@/app/museum-number-address";
import { MachineHistoryFrame } from "../machine-history";
import { Section } from "@/components/ui/section";
import { WorkLogPhotos } from "../../../team-photos";
import { AiAssessmentFolds } from "../../../ai-assessment-view";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import type { RepairHistoryData, ShownRepairHistoryEntry } from "./repair-history-data";

const { repairHistory: texts, machineHistory, machineRecord, defects, terms } = teamMessages;

/**
 * The repair history's own page (ST-033, G4a): the years with how many entries each has, the newest first; a chosen
 * year shows its entries, the newest first – every defect with its closing note and its work log entries, the newest
 * first like on the defect's page, its AI assessments folded (ST-111), and every problem resolved on the spot. Plain GET links, so it works without
 * JavaScript. Texts are plain text: React escapes them. Photos of work log entries follow with ST-032.
 */
export function RepairHistoryView({
  data,
  museumNumber,
}: {
  data: RepairHistoryData | undefined;
  museumNumber: string;
}) {
  const machine = teamMachinePage()(museumNumber);
  if (!data) return <p>{machineRecord.unknown(museumNumber)}</p>;
  return (
    <MachineHistoryFrame
      museumNumber={museumNumber}
      machineModelTitle={data.machineModelTitle}
      emptyText={data.years.length === 0 ? machineRecord.nothingRepaired : undefined}
    >
      {!data.year ? (
        <Section title={texts.chooseYear}>
          <ul className="flex flex-col gap-3 text-sm">
            {data.years.map(({ year, count }) => (
              <li key={year}>
                <Link href={`${machine}/reparaturhistorie?jahr=${year}`} className="underline underline-offset-4">
                  {machineHistory.year(year, count)}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Section title={machineHistory.year(data.year, data.years.find(({ year }) => year === data.year)?.count ?? 0)}>
          <ol className="flex flex-col gap-6">
            {data.entries.map((entry) => (
              <li key={entry.id}>
                <Entry entry={entry} />
              </li>
            ))}
          </ol>
          <BackLink href={`${machine}/reparaturhistorie`}>{texts.allYears}</BackLink>
        </Section>
      )}
    </MachineHistoryFrame>
  );
}

function Entry({ entry }: { entry: ShownRepairHistoryEntry }) {
  if (entry.kind === "resolved-on-the-spot") {
    return (
      <article className="flex flex-col gap-1 text-sm">
        <p className="font-medium">{entry.description}</p>
        <p className="text-muted-foreground">{terms["Resolved on the spot"]}</p>
        <p className="whitespace-pre-line">{entry.note}</p>
        <p className="text-muted-foreground">
          {machineRecord.whoAndWhen(entry.resolvedBy, formatDateTime(entry.resolvedAt))}
        </p>
      </article>
    );
  }
  return (
    <article className="flex flex-col gap-2 text-sm">
      <Link href={`/team/defects/${entry.id}`} className="self-start font-medium underline underline-offset-4">
        {entry.title}
      </Link>
      <p className="text-muted-foreground">
        {defects.recordedAt(formatDateTime(entry.recordedAt))}
        {entry.state === "open" && ` · ${texts.defectOpen}`}
      </p>
      {/* Every closing note, each followed by the reason it was reopened – in the order they happened (ST-030). */}
      {entry.resolutionsAndReopenings.map((step) =>
        step.kind === "resolution" ? (
          <div key={step.id} className="flex flex-col gap-1">
            <p className="font-medium">{terms["Closing note"]}</p>
            <p className="whitespace-pre-line">{step.closingNote}</p>
            <p className="text-muted-foreground">
              {defects.resolvedBy(step.resolvedBy, formatDateTime(step.resolvedAt))}
            </p>
          </div>
        ) : (
          <div key={step.id} className="flex flex-col gap-1">
            <p className="font-medium">{defects.reopenedBy(step.reopenedBy, formatDateTime(step.reopenedAt))}</p>
            <p className="whitespace-pre-line">
              {step.problemReport ? defects.reopenedBecauseOf(step.problemReport.description) : step.reason}
            </p>
          </div>
        ),
      )}
      {/* Closing on retirement is final – always the last thing that happened to the defect (ST-039). */}
      {entry.closedOnRetirementAt && (
        <p className="font-medium">{texts.closedOnRetirement(formatDateTime(entry.closedOnRetirementAt))}</p>
      )}
      {entry.workLog.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="font-medium">{defects.workLog}</p>
          <ol className="flex flex-col gap-3">
            {[...entry.workLog].reverse().map((logged) => (
              <li key={logged.id} className="flex flex-col gap-1">
                <p className="whitespace-pre-line">{logged.whatWasDone}</p>
                {logged.partsUsed && <p className="whitespace-pre-line">{defects.partsUsedLine(logged.partsUsed)}</p>}
                <p className="text-muted-foreground">
                  {machineRecord.whoAndWhen(logged.loggedBy, formatDateTime(logged.loggedAt))}
                </p>
                <WorkLogPhotos photos={logged.photos} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {/* Its AI assessments, folded – also those of a defect resolved or closed on retirement (ST-111, HS-30). */}
      <AiAssessmentFolds assessments={entry.aiAssessments} />
    </article>
  );
}
