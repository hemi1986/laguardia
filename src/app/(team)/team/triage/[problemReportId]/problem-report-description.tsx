import { teamMessages } from "@/platform/messages";
import type { TriageListItem } from "../triage-list-data";

/**
 * A problem report's description on its own page and its triage form pages – or, after a dismissal as spam, that it is
 * gone with the photo (ST-020): the only place such a problem report is still shown.
 */
export function ProblemReportDescription({
  report,
  dismissedAsSpam,
}: {
  report: Pick<TriageListItem, "description">;
  dismissedAsSpam: boolean;
}) {
  if (dismissedAsSpam) return <p>{teamMessages.dismiss.dismissedAsSpam}</p>;
  return <p className="[overflow-wrap:anywhere] whitespace-pre-line">{report.description}</p>;
}
