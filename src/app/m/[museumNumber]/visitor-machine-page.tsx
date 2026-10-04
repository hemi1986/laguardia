import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
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
  reported = false,
}: {
  data: VisitorMachinePageData;
  museumNumber: string;
  messages: VisitorMessages;
  /** Just back from the report form: the confirmation of the problem report (ST-013, G3). */
  reported?: boolean;
}) {
  const texts = messages.machinePage;
  const maker = [data.manufacturer, data.year].filter(Boolean).join(" · ");

  return (
    <>
      {reported && <Confirmation>{messages.reportForm.reported}</Confirmation>}
      <p className="text-muted-foreground">{maker}</p>
      <p className="font-medium">
        {texts.status}: {texts.statuses[data.machineStatus]}
      </p>
      {data.openDefects.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="font-medium">{texts.knownDefects}</h2>
          <ul className="list-disc ps-5 [overflow-wrap:anywhere]">
            {data.openDefects.map((title, index) => (
              <li key={index}>{title}</li>
            ))}
          </ul>
        </section>
      )}
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
