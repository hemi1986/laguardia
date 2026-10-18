import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confirmation } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { OpenDefectEntry } from "../../defects/open-defect-entry";
import type { MachineRecordData, NamedStatusChange, ShownEndedRepairHistoryEntry } from "./machine-record-data";
import type { TriagedWhenReporting } from "./triaged-when-reporting";

const { machineRecord: texts, machines, machineModels, recordDefect, terms } = teamMessages;

/** The confirmations of the triage forms (ST-018, ST-019, ST-022) – the same words, whichever page they follow. */
function triagedText(triaged: TriagedWhenReporting, museumNumber: string): string {
  switch (triaged.outcome) {
    case "defect-recorded":
      return (
        recordDefect.recorded(triaged.title, museumNumber) +
        (triaged.newStatus ? recordDefect.statusNow(museumNumber, machines.statuses[triaged.newStatus]) : "")
      );
    case "linked":
      return teamMessages.link.linked(museumNumber, triaged.title);
    case "resolved-on-the-spot":
      return teamMessages.resolveOnTheSpot.resolved(museumNumber);
  }
}

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
  moved = false,
  problemReported = false,
  triagedWhenReporting,
}: {
  record: MachineRecordData | undefined;
  museumNumber: string;
  /** Whether the team member may change this machine's status at all (G11) – the page decides it (ST-012). */
  canChangeStatus?: boolean;
  /** Just back from a status change: the confirmation names the machine and its new machine status (G3). */
  statusChanged?: boolean;
  /** Just back from a move: the confirmation names the machine and its new location (G3, ST-034). */
  moved?: boolean;
  /** Just back from a problem report: the confirmation names the machine and says it waits for triage (ST-015). */
  problemReported?: boolean;
  /** Just back from reporting a problem and triaging it in the same step (ST-023, ST-052): its confirmation (G3). */
  triagedWhenReporting?: TriagedWhenReporting;
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
      {moved && <Confirmation>{texts.moved(record.museumNumber, record.location)}</Confirmation>}
      {problemReported && <Confirmation>{texts.problemReported(record.museumNumber)}</Confirmation>}
      {triagedWhenReporting && <Confirmation>{triagedText(triagedWhenReporting, record.museumNumber)}</Confirmation>}
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
      {(canChangeStatus || !record.retirement) && (
        // The actions of section 3: moving (ST-034) any team member, not for a retired machine (G11).
        <div className="flex flex-wrap gap-2">
          {!record.retirement && (
            <Link
              href={`/team/machines/${encodeURIComponent(record.museumNumber)}/standort`}
              className={buttonVariants({ variant: "outline" })}
            >
              {texts.changeLocation}
            </Link>
          )}
          {canChangeStatus && (
            <Link
              href={`/team/machines/${encodeURIComponent(record.museumNumber)}/status`}
              className={buttonVariants({ variant: "outline" })}
            >
              {texts.changeStatus}
            </Link>
          )}
        </div>
      )}
      {/* Section 4 (ST-033): the open defects, with the same facts and words as the open defects list. */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>{texts.openDefects}</CardTitle>
          </CardHeader>
          <CardContent>
            {record.openDefects.length === 0 ? (
              <p className="text-sm">{texts.noOpenDefects}</p>
            ) : (
              <ol className="flex flex-col gap-4 [overflow-wrap:anywhere]">
                {record.openDefects.map((entry) => (
                  <li key={entry.id}>
                    <OpenDefectEntry entry={entry} withMachine={false} />
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>
      <section>
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
      </section>
      {/* Section 7 (ST-033): the most recently ended entries of the repair history; the whole repair history is a page of its own (G4a). */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>{terms["Repair history"]}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {record.repairHistoryCount === 0 ? (
              <p className="text-sm">{texts.nothingRepaired}</p>
            ) : (
              <>
                {record.recentRepairHistory.length > 0 && (
                  <ol className="flex flex-col gap-4 [overflow-wrap:anywhere]">
                    {record.recentRepairHistory.map((repair) => (
                      <li key={repair.id}>
                        <EndedEntry entry={repair} />
                      </li>
                    ))}
                  </ol>
                )}
                <Link
                  href={`/team/machines/${encodeURIComponent(record.museumNumber)}/reparaturhistorie`}
                  className="self-start text-sm underline underline-offset-4"
                >
                  {texts.wholeRepairHistory(record.repairHistoryCount)}
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </section>
      <BackToMachines />
    </>
  );
}

/** A repair that has ended: what it was, its closing note or note, who ended it and when. Texts are plain text. */
function EndedEntry({ entry: repair }: { entry: ShownEndedRepairHistoryEntry }) {
  return (
    <article className="flex flex-col gap-1 text-sm">
      {repair.kind === "defect" ? (
        <Link href={`/team/defects/${repair.id}`} className="self-start font-medium underline underline-offset-4">
          {repair.title}
        </Link>
      ) : (
        <p className="font-medium">{repair.title}</p>
      )}
      <p className="text-muted-foreground">
        {repair.kind === "defect" ? texts.defectResolved : terms["Resolved on the spot"]}
      </p>
      <p className="whitespace-pre-line">{repair.note}</p>
      <p className="text-muted-foreground">
        {texts.whoAndWhen(repair.resolvedBy ?? texts.unknownTeamMember, formatDateTime(repair.resolvedAt))}
      </p>
    </article>
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
