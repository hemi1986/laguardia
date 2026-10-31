import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { MachinesOnDisplayGroup } from "@/modules/collection";
import type { VisitorMessages } from "@/platform/messages";
import { visitorMachinePage } from "./museum-number-address";
import { VisitorPage, type MuseumNamedProps } from "./visitor-page";

/**
 * The welcome page (ST-078, ST-101): the museum's name – from the museum settings, not translated (ST-100) –, the
 * machines on display when the museum settings list them (RM-WelcomePage), each leading to its visitor machine page to
 * report a problem, and at the bottom, set apart, the way to the team login and the legal links (ST-064).
 */
export function WelcomePageView({
  museumName,
  locale,
  messages,
  machinesOnDisplay = [],
}: MuseumNamedProps & { machinesOnDisplay?: MachinesOnDisplayGroup[] }) {
  return (
    <VisitorPage title={museumName} locale={locale} messages={messages} back="/">
      {machinesOnDisplay.length > 0 && (
        <>
          <p>{messages.home.machinesOnDisplay}</p>
          {machinesOnDisplay.map((group) => (
            <MachineGroup key={group.machineCategory} group={group} messages={messages} />
          ))}
        </>
      )}
      <div className="border-t pt-4">
        <Link href="/login" className={buttonVariants({ variant: "link", className: "px-0" })}>
          {messages.home.teamLogin}
        </Link>
      </div>
    </VisitorPage>
  );
}

const machinePage = visitorMachinePage();

function MachineGroup({ group, messages }: { group: MachinesOnDisplayGroup; messages: VisitorMessages }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{messages.home.machineCategories[group.machineCategory]}</h2>
      <ul className="flex flex-col divide-y rounded-lg border">
        {group.machines.map((machine) => (
          <li key={machine.museumNumber}>
            <Link href={machinePage(machine.museumNumber)} className="hover:bg-muted flex flex-col gap-0.5 p-3">
              <span className="font-medium">{machine.machineModelTitle}</span>
              <span className="text-muted-foreground text-sm">{machine.location}</span>
              {machine.machineStatus && (
                <span className="text-sm font-medium">{messages.machinePage.statuses[machine.machineStatus]}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
