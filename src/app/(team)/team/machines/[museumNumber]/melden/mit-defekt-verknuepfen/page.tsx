import Link from "next/link";
import { redirect } from "next/navigation";
import { Page } from "@/components/page";
import { machineForTeamForm } from "@/modules/collection";
import { named } from "../../../../named";
import { openDefects } from "@/modules/repair";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../../team-session";
import { reportAndLinkAction } from "./actions";
import { ReportAndLinkForm } from "./report-and-link-form";

const { machineRecord, reportAndLink: texts, reportProblem } = teamMessages;

/**
 * „Problem melden und mit Defekt verknüpfen“ (ST-052, G21a) – the form page of the triage outcome *linked* a
 * technician chose when reporting: the problem report and the machine's open defects on one page, back on the machine
 * record afterwards. Technicians only: a helper lands on the plain report form (G11; the command refuses them anyway).
 */
export default async function ReportAndLinkPage({
  params,
}: PageProps<"/team/machines/[museumNumber]/melden/mit-defekt-verknuepfen">) {
  const member = await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
  if (member.role !== "technician") redirect(`${record}/melden`);
  const db = database();
  const machine = await machineForTeamForm(db, museumNumber);
  const [label, defects] = machine
    ? await Promise.all([
        named(db, { machines: [machine.id] }).then(({ label }) => label(machine.id)),
        openDefects(db, { machineId: machine.id }),
      ])
    : [undefined, []];

  return (
    <Page title={texts.title(museumNumber)}>
      {!machine ? (
        <p>{machineRecord.unknown(museumNumber)}</p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {museumNumber} · {label?.machineModelTitle}
          </p>
          {/* Rendered whatever the machine and its defects are now: an action re-renders this page, and a rejection
              because the defect was resolved or the machine retired meanwhile must keep the form and what was typed
              (ST-019 review). */}
          <ReportAndLinkForm
            action={reportAndLinkAction.bind(null, museumNumber)}
            museumNumber={museumNumber}
            retired={machine.retired}
            openDefects={defects.map(({ id, title, openSince }) => ({ id, title, openSince }))}
          />
        </>
      )}
      <Link href={record} className="self-start text-sm underline underline-offset-4">
        {reportProblem.back}
      </Link>
    </Page>
  );
}
