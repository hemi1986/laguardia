import Link from "next/link";
import { WorkLogPhotos } from "../../../team-photos";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import type { RepairHistoryData, ShownRepairHistoryEntry } from "./repair-history-data";

const { repairHistory: texts, machineRecord, defects, terms } = teamMessages;

/**
 * The repair history's own page (ST-033, G4a): the years with how many entries each has, the newest first; a chosen
 * year shows its entries, the newest first – every defect with its closing note and its work log entries, the newest
 * first like on the defect's page, and every problem resolved on the spot. Plain GET links, so it works without
 * JavaScript. Texts are plain text: React escapes them. Photos of work log entries follow with ST-032.
 */
export function RepairHistoryView({
  data,
  museumNumber,
}: {
  data: RepairHistoryData | undefined;
  museumNumber: string;
}) {
  const machine = `/team/machines/${encodeURIComponent(museumNumber)}`;
  if (!data) return <p>{machineRecord.unknown(museumNumber)}</p>;
  return (
    <div className="flex flex-col gap-6 [overflow-wrap:anywhere]">
      <p className="text-muted-foreground text-sm">{data.machineModelTitle}</p>
      {data.years.length === 0 ? (
        <p>{machineRecord.nothingRepaired}</p>
      ) : !data.year ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">{texts.chooseYear}</h2>
          <ul className="flex flex-col gap-3">
            {data.years.map(({ year, count }) => (
              <li key={year}>
                <Link href={`${machine}/reparaturhistorie?jahr=${year}`} className="underline underline-offset-4">
                  {texts.year(year, count)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">
            {texts.year(data.year, data.years.find(({ year }) => year === data.year)?.count ?? 0)}
          </h2>
          <ol className="flex flex-col gap-6">
            {data.entries.map((entry) => (
              <li key={entry.id}>
                <Entry entry={entry} />
              </li>
            ))}
          </ol>
          <Link href={`${machine}/reparaturhistorie`} className="self-start text-sm underline underline-offset-4">
            {texts.allYears}
          </Link>
        </section>
      )}
      <Link href={machine} className="self-start text-sm underline underline-offset-4">
        {texts.backToMachine}
      </Link>
    </div>
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
    </article>
  );
}
