import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confirmation } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { fileCategories } from "@/modules/collection";
import { OpenDefectEntry } from "../../defects/open-defect-entry";
import type { MachineRecordData, NamedStatusChange, ShownEndedRepairHistoryEntry } from "./machine-record-data";
import { triageConfirmationText } from "../../triage-confirmation";
import type { MachineRecordConfirmation } from "./machine-confirmation";
import { MachineMaintenanceSection } from "./machine-maintenance";

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
  confirmation,
}: {
  record: MachineRecordData | undefined;
  museumNumber: string;
  /** Just back from an action on this machine: what the team member did, as the journal says (G3). */
  confirmation?: MachineRecordConfirmation;
}) {
  if (!record) {
    return (
      <>
        <p>{texts.unknown(museumNumber)}</p>
        <BackToMachines />
      </>
    );
  }
  const { machineModel, actions } = record;
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
    // A retired machine shows „Ausgemustert“ in place of its machine status; the status history stays (ST-039).
    [machines.status, record.retirement ? texts.retiredInPlaceOfStatus : machines.statuses[record.machineStatus]],
  ];

  return (
    <>
      {confirmation && <Confirmation>{confirmationText(confirmation, record)}</Confirmation>}
      {confirmation?.kind === "renumbered" && (
        // A new museum number needs a new QR sticker (ST-035, ST-011) – one tap to its print page.
        <Link
          href={`/team/machines/stickers/print?m=${encodeURIComponent(record.museumNumber)}`}
          className={buttonVariants({ variant: "outline", className: "self-start" })}
        >
          {texts.printSticker}
        </Link>
      )}
      {record.retirement && (
        <p className="font-medium">
          {texts.retired(
            formatDateTime(record.retirement.retiredAt),
            record.retirement.retiredBy,
            record.retirement.reason,
          )}
        </p>
      )}
      {actions.reportProblem && (
        // Section 2 of the machine record (ST-009): reporting a problem (ST-015).
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
      {(actions.changeLocation || actions.changeStatus || actions.correctDetails) && (
        // The actions of section 3: moving (ST-034), changing the status (ST-012), correcting the details (ST-035).
        <div className="flex flex-wrap gap-2">
          {actions.changeLocation && (
            <Link
              href={`/team/machines/${encodeURIComponent(record.museumNumber)}/standort`}
              className={buttonVariants({ variant: "outline" })}
            >
              {texts.changeLocation}
            </Link>
          )}
          {actions.changeStatus && (
            <Link
              href={`/team/machines/${encodeURIComponent(record.museumNumber)}/status`}
              className={buttonVariants({ variant: "outline" })}
            >
              {texts.changeStatus}
            </Link>
          )}
          {actions.correctDetails && (
            <Link
              href={`/team/machines/${encodeURIComponent(record.museumNumber)}/angaben`}
              className={buttonVariants({ variant: "outline" })}
            >
              {texts.correctDetails}
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
      {/* Section 5 (ST-047): due maintenance and the latest maintenance records. */}
      <MachineMaintenanceSection maintenance={record.maintenance} museumNumber={record.museumNumber} />
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
      {/* Section 8 (ST-037): the files of the machine and its machine model, by file category in glossary order. */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>{texts.files}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {record.files.length === 0 ? (
              <p className="text-sm">{texts.noFiles}</p>
            ) : (
              fileCategories.map((category) => {
                const ofCategory = record.files.filter((file) => file.fileCategory === category);
                if (ofCategory.length === 0) return null;
                return (
                  <div key={category} className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium">{teamMessages.fileCategories[category]}</h3>
                    <ul className="flex flex-col gap-1 text-sm [overflow-wrap:anywhere]">
                      {ofCategory.map((file) => (
                        <li key={file.id}>
                          <a href={`/team/dateien/${file.id}`} className="underline underline-offset-4">
                            {file.title}
                          </a>
                          {file.ofMachineModel && (
                            <span className="text-muted-foreground"> · {texts.ofMachineModel}</span>
                          )}
                          {actions.removeFile && (
                            <>
                              {" · "}
                              <Link
                                href={`/team/machines/${encodeURIComponent(record.museumNumber)}/datei-entfernen/${file.id}`}
                                aria-label={texts.removeFileLabel(file.title)}
                                className="text-muted-foreground underline underline-offset-4"
                              >
                                {texts.removeFile}
                              </Link>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
            {actions.attachFile && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/team/machines/${encodeURIComponent(record.museumNumber)}/datei-anhaengen`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {texts.attachFile}
                </Link>
                <Link
                  href={`/team/machines/${encodeURIComponent(record.museumNumber)}/foto-anhaengen`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {texts.attachPhoto}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      {actions.retire && (
        // Section 9 (ST-039, G18): retiring – it leads to its own page, which asks once (G10b).
        <section>
          <Link
            href={`/team/machines/${encodeURIComponent(record.museumNumber)}/ausmustern`}
            className={buttonVariants({ variant: "outline", className: "self-start" })}
          >
            {texts.retire}
          </Link>
        </section>
      )}
      <BackToMachines />
    </>
  );
}

/** The confirmation in words (G3): names the machine and what it is now. */
function confirmationText(confirmation: MachineRecordConfirmation, record: MachineRecordData): string {
  switch (confirmation.kind) {
    case "status-changed":
      return texts.statusChanged(record.museumNumber, machines.statuses[record.machineStatus]);
    case "moved":
      return texts.moved(record.museumNumber, record.location);
    case "retired":
      return texts.retiredConfirmation(record.museumNumber);
    case "renumbered":
      return texts.renumbered(confirmation.previousMuseumNumber, record.museumNumber);
    case "details-corrected":
      return texts.detailsCorrected(record.museumNumber);
    case "problem-reported":
      return texts.problemReported(record.museumNumber);
    case "file-removed":
      return texts.fileRemoved(confirmation.title);
    case "file-attached":
      return texts.fileAttached(confirmation.title);
    case "maintenance-recorded":
      return teamMessages.recordMaintenance.recorded(record.museumNumber);
    case "triaged":
      return triageConfirmationText(confirmation.triaged);
  }
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
      <p className="text-muted-foreground">{texts.whoAndWhen(repair.resolvedBy, formatDateTime(repair.resolvedAt))}</p>
    </article>
  );
}

function StatusChangeEntry({ change }: { change: NamedStatusChange }) {
  const who = change.changedBy;
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
