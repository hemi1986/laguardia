import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { teamMessages } from "@/platform/messages";
import { MachineLink } from "./machine-link";
import { dueMaintenanceAddress } from "./maintenance/due-maintenance-data";
import { NewMark } from "./new-mark";
import type { RecentChange, TechnicianDashboardData } from "./technician-dashboard-data";

const { technicianDashboard: texts, machines } = teamMessages;

/**
 * The technician dashboard (RM-TechnicianDashboard, ST-048, owner of the page – G18): section 1 says how many problem
 * reports wait for triage and how many of them long, in words, and leads to the triage list without repeating it (G5,
 * G6, G6a); section 2 lists the machines that could return to play, each with its one action, „Status ändern“ on the
 * machine (HS-6). ST-058 fills sections 3 to 5: 3 the stale claims, each with the reason in words; 4 how many
 * machines each overdue maintenance task is overdue on, leading to „Wartung“ without repeating it (G18); 5 the recent
 * changes – not something that needs attention, so they stay below the all-empty sentence. Empty is the good state, and
 * it says so (G7).
 */
export function TechnicianDashboard({ data }: { data: TechnicianDashboardData }) {
  const {
    problemReports,
    machinesToReturnToPlay,
    staleClaims,
    overdueMaintenance,
    recentChanges,
    recentSinceLastVisit,
  } = data;
  if (
    problemReports.untriaged === 0 &&
    machinesToReturnToPlay.length === 0 &&
    staleClaims.length === 0 &&
    overdueMaintenance.length === 0
  ) {
    return (
      <>
        <p>{texts.nothingNeedsAttention}</p>
        {recentChanges.length > 0 && <RecentChanges changes={recentChanges} sinceLastVisit={recentSinceLastVisit} />}
      </>
    );
  }
  return (
    <>
      {/* Section 1 – problem reports to triage. */}
      <Section title={texts.toTriage} contentClassName="gap-3">
        {problemReports.untriaged === 0 ? (
          <p className="text-sm">{texts.noneToTriage}</p>
        ) : (
          <>
            <p className="text-sm">{texts.waiting(problemReports.untriaged, problemReports.waitingLong)}</p>
            {problemReports.newSinceLastVisit > 0 && (
              <p className="text-sm font-medium">
                {texts.newOfWaiting(problemReports.untriaged, problemReports.newSinceLastVisit)}
              </p>
            )}
            <Link href="/team/triage" className={buttonVariants({ variant: "outline", className: "self-start" })}>
              {texts.openTriage}
            </Link>
          </>
        )}
      </Section>
      {/* Section 2 – machines not playable without open defects. */}
      <Section title={texts.toReturnToPlay}>
        {machinesToReturnToPlay.length === 0 ? (
          <p className="text-sm">{texts.noneToReturnToPlay}</p>
        ) : (
          <ul className="flex flex-col gap-4 [overflow-wrap:anywhere]">
            {machinesToReturnToPlay.map((machine) => (
              <li key={machine.museumNumber}>
                <article className="flex flex-col gap-1 text-sm">
                  <MachineLink museumNumber={machine.museumNumber} machineModelTitle={machine.machineModelTitle} />
                  <p className="text-muted-foreground">
                    {texts.withoutOpenDefects(machines.statuses[machine.machineStatus])}
                  </p>
                  <Link
                    href={`/team/machines/${encodeURIComponent(machine.museumNumber)}/status`}
                    className={buttonVariants({ variant: "outline", size: "sm", className: "mt-1 self-start" })}
                  >
                    {teamMessages.machineRecord.changeStatus}
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {/* Section 3 – stale claims, only singled out (ST-058). */}
      <Section title={texts.staleClaims}>
        {staleClaims.length === 0 ? (
          <p className="text-sm">{texts.noneStale}</p>
        ) : (
          <ul className="flex flex-col gap-4 [overflow-wrap:anywhere]">
            {staleClaims.map((claim) => (
              <li key={claim.defectId}>
                <article className="flex flex-col gap-1 text-sm">
                  {/* A defect is its title as the link, its machine on the line below – the open defects' entry (G15). */}
                  <Link
                    href={`/team/defects/${claim.defectId}`}
                    className="self-start font-medium underline underline-offset-4"
                  >
                    {claim.title}
                  </Link>
                  <p>
                    {claim.museumNumber} · {claim.machineModelTitle}
                  </p>
                  <p className="text-muted-foreground">{texts.staleBecause(claim.claimant)}</p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {/* Section 4 – overdue maintenance, counted (ST-058). */}
      <Section title={texts.overdueMaintenance} contentClassName="gap-3">
        {overdueMaintenance.length === 0 ? (
          <p className="text-sm">{texts.noneOverdue}</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2 text-sm [overflow-wrap:anywhere]">
              {overdueMaintenance.map((task) => (
                <li key={task.id}>{texts.overdue(task.name, task.overdueCount)}</li>
              ))}
            </ul>
            <Link
              href={dueMaintenanceAddress({})}
              className={buttonVariants({ variant: "outline", className: "self-start" })}
            >
              {texts.openDueMaintenance}
            </Link>
          </>
        )}
      </Section>
      <RecentChanges changes={recentChanges} sinceLastVisit={recentSinceLastVisit} />
    </>
  );
}

/** Section 5 – machine status changes and defects resolved or reopened, newest first, each with who and when (ST-058). */
function RecentChanges({ changes, sinceLastVisit }: { changes: RecentChange[]; sinceLastVisit: boolean }) {
  return (
    <Section title={texts.recentChanges}>
      {changes.length === 0 ? (
        <p className="text-sm">{sinceLastVisit ? texts.noChangesSinceLastVisit : texts.noRecentChanges}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm [overflow-wrap:anywhere]">
          {changes.map((change, index) => (
            <li key={index}>
              {change.kind === "status-change" ? (
                <>
                  <Link
                    href={`/team/machines/${encodeURIComponent(change.museumNumber)}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {change.museumNumber}
                  </Link>
                  {texts.statusChanged(
                    machines.statuses[change.previousStatus],
                    machines.statuses[change.newStatus],
                    change.by,
                    change.hoursAgo,
                  )}
                  <NewMark shown={change.newSinceLastVisit} />
                </>
              ) : (
                <>
                  <Link href={`/team/defects/${change.defectId}`} className="font-medium underline underline-offset-4">
                    „{change.title}“
                  </Link>
                  {texts.defectChanged(change.kind, change.museumNumber, change.by, change.hoursAgo)}
                  <NewMark shown={change.newSinceLastVisit} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
