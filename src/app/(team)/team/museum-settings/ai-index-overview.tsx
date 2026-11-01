import { teamMessages } from "@/platform/messages";
import { retryFileIndexingAction } from "./ai-index-actions";
import type { ShownAiIndexOverview } from "./ai-settings-data";
import { RetryFileIndexingForm } from "./retry-file-indexing-form";

const { aiIndex: texts } = teamMessages;

const count = new Intl.NumberFormat("de-DE");
const dollars = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The overview „KI-Erfassung“ below the AI settings (ST-109, RM-AiSettings): how many files are indexed, waiting and
 * failed, what indexing has cost so far, and the failed files with what they belong to and why (G7: an empty index
 * says so). German numbers and the cost in German notation (G13).
 */
export function AiIndexOverviewView({ overview }: { overview: ShownAiIndexOverview }) {
  const empty = overview.indexed === 0 && overview.waiting === 0 && overview.failed.length === 0;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium">{texts.title}</h3>
      {empty ? (
        <p>{texts.empty}</p>
      ) : (
        <p>
          {texts.counts(count.format(overview.indexed), count.format(overview.waiting), count.format(overview.failed.length))}
        </p>
      )}
      <p>{texts.cost(dollars.format(overview.cost))}</p>
      {overview.failed.length > 0 && (
        <ul className="flex flex-col gap-2">
          {overview.failed.map((file) => (
            <li key={file.fileId} className="flex flex-col gap-1">
              <span>{texts.failedFile(file.owner, file.title, texts.failureReasons[file.reason])}</span>
              <RetryFileIndexingForm action={retryFileIndexingAction} fileId={file.fileId} version={file.version} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
