import Link from "next/link";
import { redirect } from "next/navigation";
import { Page } from "@/components/page";
import { machineForTeamForm } from "@/modules/collection";
import { named } from "../../../../named";
import { stricterMachineStatuses } from "@/modules/repair";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../../team-session";
import { reportAndRecordDefectAction } from "./actions";
import { ReportAndRecordDefectForm } from "./report-and-record-defect-form";

const { machineRecord, reportAndRecordDefect: texts, reportProblem } = teamMessages;

/**
 * „Problem melden und Defekt erfassen“ (ST-023, G21a) – the form page of the triage outcome *record a defect* a
 * technician chose when reporting: the problem report and the defect on one page, back on the machine record
 * afterwards. Technicians only: a helper lands on the plain report form (G11; the command refuses them anyway).
 */
export default async function ReportAndRecordDefectPage({
  params,
}: PageProps<"/team/machines/[museumNumber]/melden/defekt-erfassen">) {
  const member = await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
  if (member.role !== "technician") redirect(`${record}/melden`);
  const db = database();
  const machine = await machineForTeamForm(db, museumNumber);
  const label = machine && (await named(db, { machines: [machine.id] })).label(machine.id);

  return (
    <Page title={texts.title(museumNumber)}>
      {!machine ? (
        <p>{machineRecord.unknown(museumNumber)}</p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {museumNumber} · {label?.machineModelTitle}
          </p>
          {/* Rendered for a retired machine too: an action re-renders this page, and a rejection because the machine
              was retired meanwhile must keep the form and what was typed (ST-019 review). */}
          <ReportAndRecordDefectForm
            action={reportAndRecordDefectAction.bind(null, museumNumber)}
            museumNumber={museumNumber}
            machine={{
              status: machine.machineStatus,
              version: machine.version,
              stricter: stricterMachineStatuses(machine.machineStatus),
              retired: machine.retired,
            }}
          />
        </>
      )}
      <Link href={record} className="self-start text-sm underline underline-offset-4">
        {reportProblem.back}
      </Link>
    </Page>
  );
}
