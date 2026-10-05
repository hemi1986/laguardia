import Link from "next/link";
import { Page } from "@/components/page";
import { machineForTeamForm } from "@/modules/collection";
import { stricterMachineStatuses } from "@/modules/repair";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../../team-session";
import { loadProblemReport } from "../problem-report-data";
import { recordDefectAction } from "./actions";
import { RecordDefectForm } from "./record-defect-form";

const { recordDefect: texts, triage } = teamMessages;

/**
 * „Defekt erfassen“ (ST-018) – the form page of one triage outcome (G21): it repeats the machine and the description,
 * and lands on the triage list. Technicians only (helpers are sent away; the command refuses them anyway).
 */
export default async function RecordDefectPage({
  params,
}: PageProps<"/team/triage/[problemReportId]/defekt-erfassen">) {
  await requireTechnician();
  const { problemReportId } = await params;
  const db = database();
  const data = await loadProblemReport(db, systemClock, problemReportId);
  const machine = data && (await machineForTeamForm(db, data.report.museumNumber));
  const museumNumber = data?.report.museumNumber ?? "";

  return (
    <Page title={data ? texts.title(museumNumber) : teamMessages.terms["Problem report"]}>
      {!data || !machine ? (
        <p>{triage.unknown}</p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {museumNumber} · {data.report.machineModelTitle}
          </p>
          <p className="[overflow-wrap:anywhere] whitespace-pre-line">{data.report.description}</p>
          {/* Rendered for a triaged problem report too: an action re-renders this page (the session cookie is renewed),
              and a rejection because someone triaged first must keep the form and what was typed (ST-019 review). */}
          <RecordDefectForm
            action={recordDefectAction.bind(null, problemReportId)}
            version={data.version}
            triaged={data.triaged}
            museumNumber={museumNumber}
            machine={{
              status: machine.machineStatus,
              version: machine.version,
              stricter: stricterMachineStatuses(machine.machineStatus),
            }}
          />
        </>
      )}
      <Link href={`/team/triage/${problemReportId}`} className="self-start text-sm underline underline-offset-4">
        {texts.back}
      </Link>
    </Page>
  );
}
