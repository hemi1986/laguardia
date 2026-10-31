import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { MachinesOnDisplayGroup } from "@/modules/collection";
import type { VisitorMessages } from "@/platform/messages";
import { visitorMachinePage } from "./museum-number-address";
import { VisitorPage, type MuseumNamedProps } from "./visitor-page";

/**
 * The welcome page (ST-078, ST-101, ST-102): the museum's logo, if there is one, centred above the name and at most about
 * a third of the screen's height, so the name stays visible on a phone; the museum's name – from the museum settings, not translated (ST-100) –, the
 * machines on display when the museum settings list them (RM-WelcomePage), each leading to its visitor machine page to
 * report a problem, and at the bottom, set apart, the way to the team login and the legal links (ST-064).
 */
export function WelcomePageView({
  museumName,
  locale,
  messages,
  hasLogo,
  machinesOnDisplay,
}: MuseumNamedProps & { hasLogo?: boolean; machinesOnDisplay: MachinesOnDisplayGroup[] }) {
  const logo = hasLogo && (
    // The public address `/logo` sends the browser on to a short-lived view address of the private store (ST-102).
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo" alt={messages.welcomePage.logo} className="mx-auto max-h-[33dvh] w-auto max-w-full object-contain" />
  );
  return (
    <VisitorPage title={museumName} locale={locale} messages={messages} back="/" above={logo}>
      {machinesOnDisplay.length > 0 && (
        <>
          <p>{messages.welcomePage.machinesOnDisplay}</p>
          {machinesOnDisplay.map((group) => (
            <MachineGroup key={group.machineCategory} group={group} messages={messages} />
          ))}
        </>
      )}
      <div className="border-t pt-4">
        <Link href="/login" className={buttonVariants({ variant: "link", className: "px-0" })}>
          {messages.welcomePage.teamLogin}
        </Link>
      </div>
    </VisitorPage>
  );
}

const machinePage = visitorMachinePage();

function MachineGroup({ group, messages }: { group: MachinesOnDisplayGroup; messages: VisitorMessages }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{messages.welcomePage.machineCategories[group.machineCategory]}</h2>
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
