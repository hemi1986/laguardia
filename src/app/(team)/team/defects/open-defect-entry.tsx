import Link from "next/link";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { claimantText } from "../claimant";
import type { OpenDefectsItem } from "./open-defects-data";

const { defects: texts, recordDefect, terms } = teamMessages;

/**
 * One open defect as the team sees it (RM-OpenDefects, ST-021): what tells it apart (G5), its title leading to the
 * defect's own page. The open defects list and the machine record's open defects (ST-033) show the same entry – on
 * the machine record without the machine, which the page already names. Titles are plain text: React escapes them.
 */
export function OpenDefectEntry({ entry, withMachine = true }: { entry: OpenDefectsItem; withMachine?: boolean }) {
  return (
    <article className="flex flex-col gap-1 text-sm">
      <Link href={`/team/defects/${entry.id}`} className="font-medium underline underline-offset-4">
        {entry.title}
      </Link>
      {withMachine && (
        <p>
          {entry.museumNumber} · {entry.machineModelTitle}
        </p>
      )}
      <p className="text-muted-foreground">
        {texts.priority(recordDefect.priorities[entry.priority])}
        {entry.suitableForHelpers && ` · ${terms["Suitable for helpers"]}`}
      </p>
      <p className="text-muted-foreground">
        {formatDateTime(entry.openSince)} · {texts.openFor(entry.openDays)}
      </p>
      {entry.holdReason && <p className="font-medium">{texts.onHold(texts.holdReasons[entry.holdReason])}</p>}
      {entry.claimant && <p className="text-muted-foreground">{claimantText(entry.claimant)}</p>}
      {entry.lastWorkLogEntry && (
        <p className="text-muted-foreground">
          {texts.lastWorkLogEntry(formatDateTime(entry.lastWorkLogEntry.loggedAt), entry.lastWorkLogEntry.loggedBy)}
        </p>
      )}
      {entry.linkedProblemReports > 0 && (
        <p className="text-muted-foreground">{texts.linkedProblemReports(entry.linkedProblemReports)}</p>
      )}
    </article>
  );
}
