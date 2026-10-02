import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import type { MachineRecordData, NamedStatusChange } from "./machine-record-data";

const { machineRecord: texts, machines, machineModels, terms } = teamMessages;

/**
 * The machine record (RM-MachineRecord, ST-009) – the base of the page later stories add their sections to, in the
 * order the owner story fixes (G18): details, then the machine status history newest first. Times in Europe/Berlin.
 * A retired machine keeps its record and says so in words (G6a).
 */
export function MachineRecordView({ record, museumNumber }: { record: MachineRecordData | undefined; museumNumber: string }) {
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
      {record.retirement && (
        <p className="font-medium">
          {texts.retired(formatDateTime(record.retirement.retiredAt), record.retirement.reason)}
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {details.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <Card>
        <CardHeader>
          <CardTitle>{texts.statusHistory}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            {record.statusHistory.map((change, index) => (
              <li key={index} className="flex flex-col gap-0.5 text-sm">
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
