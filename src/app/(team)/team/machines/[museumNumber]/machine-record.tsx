import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confirmation } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import type { MachineRecordData, NamedStatusChange } from "./machine-record-data";

const { machineRecord: texts, machines, machineModels, terms } = teamMessages;

/**
 * The machine record (RM-MachineRecord, ST-009). ST-009 owns the page (G18) and fixed its sections, top to bottom:
 * retirement note, "Problem melden" (ST-015), details with their actions (ST-012, ST-034, ST-035, ST-011), open
 * defects (ST-021), due maintenance (ST-047), status history, repair history (ST-033), files (ST-037), retiring
 * (ST-039) – see the story. Times in Europe/Berlin. A retired machine keeps its record and says so in words (G6a).
 */
export function MachineRecordView({
  record,
  museumNumber,
  canChangeStatus = false,
  statusChanged = false,
  problemReported = false,
}: {
  record: MachineRecordData | undefined;
  museumNumber: string;
  /** Whether the team member may change this machine's status at all (G11) – the page decides it (ST-012). */
  canChangeStatus?: boolean;
  /** Just back from a status change: the confirmation names the machine and its new machine status (G3). */
  statusChanged?: boolean;
  /** Just back from a problem report: the confirmation names the machine and says it waits for triage (ST-015). */
  problemReported?: boolean;
}) {
  if (!record) {
    return (
      <>
        <p>{texts.unknown(museumNumber)}</p>
        <BackToMachines />
      </>
    );
  }
  const { machineModel } = record;
  const details: [string, string][] = [
    [terms["Serial number"], record.serialNumber ?? texts.noSerialNumber],
    [terms["Machine model"], machineModel.title],
    [texts.manufacturer, machineModel.manufacturer],
    ...(machineModel.year ? [[texts.year, String(machineModel.year)] as [string, string]] : []),
    [terms["Machine category"], machineModels.categories[machineModel.machineCategory]],
    ...(machineModel.technology
      ? [[terms.Technology, machineModels.technologies[machineModel.technology]] as [string, string]]
      : []),
    [terms.Location, record.location],
    [machines.status, machines.statuses[record.machineStatus]],
  ];

  return (
    <>
      {statusChanged && (
        <Confirmation>{texts.statusChanged(record.museumNumber, machines.statuses[record.machineStatus])}</Confirmation>
      )}
      {problemReported && <Confirmation>{texts.problemReported(record.museumNumber)}</Confirmation>}
      {record.retirement && (
        <p className="font-medium">
          {texts.retired(
            formatDateTime(record.retirement.retiredAt),
            record.retirement.retiredBy ?? texts.unknownTeamMember,
            record.retirement.reason,
          )}
        </p>
      )}
      {!record.retirement && (
        // Section 2 of the machine record (ST-009): reporting a problem – any team member, not for a retired machine (G11).
        <Link
          href={`/team/machines/${encodeURIComponent(record.museumNumber)}/melden`}
          className={buttonVariants({ className: "self-start" })}
        >
          {texts.reportProblem}
        </Link>
      )}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm [overflow-wrap:anywhere]">
        {details.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {canChangeStatus && (
        <Link
          href={`/team/machines/${encodeURIComponent(record.museumNumber)}/status`}
          className={buttonVariants({ variant: "outline", className: "self-start" })}
        >
          {texts.changeStatus}
        </Link>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{terms["Status history"]}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3 [overflow-wrap:anywhere]">
            {record.statusHistory.map((change) => (
              <li key={change.id} className="flex flex-col gap-0.5 text-sm">
                <StatusChangeEntry change={change} />
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <BackToMachines />
    </>
  );
}

function StatusChangeEntry({ change }: { change: NamedStatusChange }) {
  const who = change.changedBy ?? texts.unknownTeamMember;
  const when = formatDateTime(change.changedAt);
  if (!change.previousStatus) {
    return (
      <>
        <span className="font-medium">{texts.registeredAs(machines.statuses[change.newStatus])}</span>
        <span className="text-muted-foreground">
          {who} · {when}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="font-medium">
        {machines.statuses[change.previousStatus]} → {machines.statuses[change.newStatus]}
      </span>
      <span className="text-muted-foreground">
        {change.reason} · {who} · {when}
      </span>
    </>
  );
}

function BackToMachines() {
  return (
    <Link href="/team/machines" className="self-start text-sm underline underline-offset-4">
      {machines.back}
    </Link>
  );
}
