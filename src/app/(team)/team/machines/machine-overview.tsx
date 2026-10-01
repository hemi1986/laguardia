import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Confirmation } from "@/components/ui/message";
import type { MachineOverviewEntry } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";

const { machines: texts } = teamMessages;

/**
 * The machine overview (RM-MachineOverview) as ST-007 ships it: a plain list of the active machines, sorted by
 * museum number. Registering is a named action directly under the heading (G2a), shown to technicians only (G11).
 * ST-008 adds the counts, the machine status filter and the search.
 */
export function MachineOverview({
  machines,
  canRegister,
  registered,
}: {
  machines: MachineOverviewEntry[];
  canRegister: boolean;
  /** The machine just registered – named in the confirmation (G3). */
  registered?: MachineOverviewEntry;
}) {
  return (
    <>
      {canRegister && (
        <Link href="/team/machines/new" className={buttonVariants({ className: "self-start" })}>
          {texts.register}
        </Link>
      )}
      {registered && (
        <Confirmation>{texts.registered(registered.museumNumber, registered.machineModelTitle)}</Confirmation>
      )}
      {machines.length === 0 ? (
        <p>{texts.empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {machines.map((machine) => (
            <li key={machine.id}>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {machine.museumNumber} · {machine.machineModelTitle}
                  </CardTitle>
                  <CardDescription>
                    {machine.location} · {texts.status}: {texts.statuses[machine.machineStatus]}
                  </CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
