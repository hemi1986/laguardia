import { Confirmation } from "@/components/ui/message";
import { fileDetailsAddress } from "@/app/(team)/team/dateien/[fileId]/details/file-origin";
import { teamMessages } from "@/platform/messages";
import type { ShownAiIndexOverview } from "./ai-settings-data";
import type { FailedFileRow } from "./retry-file-indexing-form";

const { aiIndex: texts } = teamMessages;

const dollars = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The overview „KI-Erfassung“ below the AI settings (ST-109, RM-AiSettings): how many files are indexed, waiting and
 * failed and what indexing has cost so far (G7: an empty index says so). German numbers and the cost in German
 * notation (G13). The failed files follow in `FailedFiles`, which the section renders in a place of its own.
 */
export function AiIndexOverviewView({
  overview,
  retried,
}: {
  overview: ShownAiIndexOverview;
  /** The title of the file the technician just tried again (G3). */
  retried: string | undefined;
}) {
  const empty = overview.indexed === 0 && overview.waiting === 0 && overview.failed.length === 0;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium">{texts.title}</h3>
      {retried && <Confirmation>{texts.retrying(retried)}</Confirmation>}
      {empty ? <p>{texts.empty}</p> : <p>{texts.counts(overview.indexed, overview.waiting, overview.failed.length)}</p>}
      <p>{texts.cost(dollars.format(overview.cost))}</p>
    </div>
  );
}

/**
 * The failed files' rows: „LG-042 · Attract mode.mp4 – Dateiformat wird nicht erfasst“, the title leading to the file
 * details with the form „KI“ as its origin (ST-114) – none while AI is off.
 */
export function failedFileRows(overview: ShownAiIndexOverview | undefined): FailedFileRow[] {
  return (overview?.failed ?? []).map((file) => ({
    fileId: file.fileId,
    version: file.version,
    title: file.title,
    href: fileDetailsAddress(file.fileId, "settings"),
    before: texts.failedFile.before(file.owner),
    after: texts.failedFile.after(texts.failureReasons[file.reason]),
  }));
}
