import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { teamMessages } from "@/platform/messages";
import type { TechnicianDashboardData } from "./technician-dashboard-data";

const { technicianDashboard: texts, machines } = teamMessages;

/**
 * The technician dashboard (RM-TechnicianDashboard, ST-048, owner of the page – G18): section 1 says how many problem
 * reports wait for triage and how many of them long, in words, and leads to the triage list without repeating it (G5,
 * G6, G6a); section 2 lists the machines that could return to play, each with its one action, „Status ändern“ on the
 * machine (HS-6). ST-058 fills sections 3 to 5: 3 the stale claims, each with the reason in words. Empty is the good
 * state, and it says so (G7).
 */
export function TechnicianDashboard({ data }: { data: TechnicianDashboardData }) {
  const { problemReports, machinesToReturnToPlay, staleClaims } = data;
  if (problemReports.untriaged === 0 && machinesToReturnToPlay.length === 0 && staleClaims.length === 0) {
    return <p>{texts.nothingNeedsAttention}</p>;
  }
  return (
    <>
      {/* Section 1 – problem reports to triage. */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>{texts.toTriage}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {problemReports.untriaged === 0 ? (
              <p className="text-sm">{texts.noneToTriage}</p>
            ) : (
              <>
                <p className="text-sm">{texts.waiting(problemReports.untriaged, problemReports.waitingLong)}</p>
                <Link href="/team/triage" className={buttonVariants({ variant: "outline", className: "self-start" })}>
                  {texts.openTriage}
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </section>
      {/* Section 2 – machines not playable without open defects. */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>{texts.toReturnToPlay}</CardTitle>
          </CardHeader>
          <CardContent>
            {machinesToReturnToPlay.length === 0 ? (
              <p className="text-sm">{texts.noneToReturnToPlay}</p>
            ) : (
              <ul className="flex flex-col gap-4 [overflow-wrap:anywhere]">
                {machinesToReturnToPlay.map((machine) => (
                  <li key={machine.museumNumber}>
                    <article className="flex flex-col gap-1 text-sm">
                      <p>
                        <Link
                          href={`/team/machines/${encodeURIComponent(machine.museumNumber)}`}
                          className="font-medium underline underline-offset-4"
                        >
                          {machine.museumNumber}
                        </Link>{" "}
                        · {machine.machineModelTitle}
                      </p>
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
          </CardContent>
        </Card>
      </section>
      {/* Section 3 – stale claims, only singled out (ST-058). */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>{texts.staleClaims}</CardTitle>
          </CardHeader>
          <CardContent>
            {staleClaims.length === 0 ? (
              <p className="text-sm">{texts.noneStale}</p>
            ) : (
              <ul className="flex flex-col gap-4 [overflow-wrap:anywhere]">
                {staleClaims.map((claim) => (
                  <li key={claim.defectId}>
                    <article className="flex flex-col gap-1 text-sm">
                      <p>
                        <Link href={`/team/defects/${claim.defectId}`} className="font-medium underline underline-offset-4">
                          {claim.title}
                        </Link>{" "}
                        · {claim.museumNumber} · {claim.machineModelTitle}
                      </p>
                      <p className="text-muted-foreground">{texts.staleBecause(claim.claimant)}</p>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
