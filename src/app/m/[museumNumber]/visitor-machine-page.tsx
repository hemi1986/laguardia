import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { VisitorMessages } from "@/platform/messages";
import type { VisitorMachinePageData } from "./visitor-machine-page-data";

/**
 * The visitor machine page (ST-010): deliberately minimal – the machine model, the machine status and the way to
 * report a problem (a page of its own, ST-013). Shows nothing internal: no names, no problem report text, no IDs.
 */
export function VisitorMachinePage({
  data,
  museumNumber,
  messages,
}: {
  data: VisitorMachinePageData;
  museumNumber: string;
  messages: VisitorMessages;
}) {
  const texts = messages.machinePage;
  const maker = [data.manufacturer, data.year].filter(Boolean).join(" · ");

  return (
    <>
      <p className="text-muted-foreground">{maker}</p>
      <p className="font-medium">
        {texts.status}: {texts.statuses[data.machineStatus]}
      </p>
      {data.untriagedProblemReports > 0 && <p>{texts.alreadyReported(data.untriagedProblemReports)}</p>}
      {data.reportingPossible ? (
        <Link href={`/m/${museumNumber}/melden`} className={buttonVariants({ className: "self-start" })}>
          {texts.reportProblem}
        </Link>
      ) : (
        <p>{texts.notOnDisplay}</p>
      )}
    </>
  );
}
