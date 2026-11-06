import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterForm } from "@/components/ui/filter-form";
import { Confirmation } from "@/components/ui/message";
import { machineStatuses, type MachineStatus } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";
import type { MachineOverviewItem, OverviewQuery } from "./machine-overview-data";
import { MachineSearch } from "./machine-search";

const { machines: texts, machineModels } = teamMessages;

/** The address of the overview for a search and a filter – a plain link, so it works without JavaScript. */
function overviewHref({ search, machineStatus, retired }: OverviewQuery): string {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (machineStatus) params.set("machineStatus", machineStatus);
  if (retired) params.set("retired", "1");
  const query = params.toString();
  return query ? `/team/machines?${query}` : "/team/machines";
}

/**
 * The machine overview (RM-MachineOverview, ST-007/ST-008): how many active machines have which machine status –
 * each count is also the filter for it –, the search, and the list sorted by museum number. Retired machines join
 * the list with the filter for them or when a search finds them, marked „Ausgemustert“ (ST-055). Registering is a
 * named action directly under the heading (G2a), shown to technicians only (G11).
 */
export function MachineOverview({
  machines,
  counts,
  retiredCount,
  query,
  canRegister,
  registered,
}: {
  machines: MachineOverviewItem[];
  /** Over all active machines – independent of the search and the filter (ST-008). */
  counts: Record<MachineStatus, number>;
  /** How many machines are retired (ST-055). */
  retiredCount: number;
  query: OverviewQuery;
  canRegister: boolean;
  /** The machine just registered – named in the confirmation (G3). */
  registered?: MachineOverviewItem;
}) {
  const total = machineStatuses.reduce((sum, status) => sum + counts[status], 0);
  const search = query.search?.trim();
  const { retired } = query;

  return (
    <>
      {/* The confirmation is the first thing under the heading (G3, ST-092). */}
      {registered && (
        <Confirmation>{texts.registered(registered.museumNumber, registered.machineModelTitle)}</Confirmation>
      )}
      {canRegister && (
        <div className="flex flex-wrap gap-2">
          <Link href="/team/machines/new" className={buttonVariants()}>
            {texts.register}
          </Link>
          <Link href="/team/machines/stickers" className={buttonVariants({ variant: "outline" })}>
            {teamMessages.stickers.print}
          </Link>
        </div>
      )}
      {total + retiredCount === 0 ? (
        <p>{texts.empty}</p>
      ) : (
        <>
          {/* The search and the filter are applied each with its own button and keep each other (G32, ST-092). */}
          <MachineSearch action="/team/machines" search={search}>
            {query.machineStatus && <input type="hidden" name="machineStatus" value={query.machineStatus} />}
            {retired && <input type="hidden" name="retired" value="1" />}
          </MachineSearch>
          <FilterForm action="/team/machines" label={texts.retiredFilter} apply={teamMessages.filters.apply}>
            {search && <input type="hidden" name="search" value={search} />}
            {query.machineStatus && <input type="hidden" name="machineStatus" value={query.machineStatus} />}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="retired" value="1" defaultChecked={retired} />
              {texts.showRetired}
            </label>
          </FilterForm>
          <nav aria-label={texts.filter}>
            <ul className="flex flex-wrap gap-2">
              <FilterLink href={overviewHref({ search, retired })} current={!query.machineStatus}>
                {texts.all} · {total}
              </FilterLink>
              {machineStatuses.map((status) => (
                <FilterLink
                  key={status}
                  href={overviewHref({ search, machineStatus: status, retired })}
                  current={query.machineStatus === status}
                >
                  {texts.statuses[status]} · {counts[status]}
                </FilterLink>
              ))}
            </ul>
          </nav>
          {machines.length === 0 ? (
            <NothingFound search={search} machineStatus={query.machineStatus} retired={retired} />
          ) : (
            <ul className="flex flex-col gap-4 [overflow-wrap:anywhere]">
              {machines.map((machine) => (
                <li key={machine.id}>
                  <MachineEntry machine={machine} />
                </li>
              ))}
            </ul>
          )}
          {retired && retiredCount === 0 && <p>{texts.noneRetired}</p>}
        </>
      )}
    </>
  );
}

function FilterLink({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={buttonVariants({ variant: current ? "default" : "outline", size: "sm" })}
      >
        {children}
      </Link>
    </li>
  );
}

/**
 * The "nothing found" cases say what to do about them (G7). A search names what was searched for and offers to
 * clear it (the filter stays); with a machine status only that filter can have emptied the list; with neither, every
 * machine is retired – the filter for them finds them (ST-055).
 */
function NothingFound({ search, machineStatus, retired }: OverviewQuery) {
  if (!search) return <p>{machineStatus ? texts.noneWithStatus(texts.statuses[machineStatus]) : texts.allRetired}</p>;
  return (
    <div className="flex flex-col gap-2">
      <p>{texts.noMatch(search)}</p>
      <BackLink href={overviewHref({ machineStatus, retired })}>{texts.clearSearch}</BackLink>
    </div>
  );
}

/**
 * What tells a machine apart from its neighbours (G5) – with its open defects (ST-021) and overdue maintenance tasks
 * (ST-057); its title leads to its machine record (ST-009).
 */
function MachineEntry({ machine }: { machine: MachineOverviewItem }) {
  const details = [
    machineModels.categories[machine.machineCategory],
    machine.technology && machineModels.technologies[machine.technology],
    machine.location,
    // A retired machine has no machine status any more – the marker stands in its place (G6, ST-039).
    machine.retired ? texts.retired : `${texts.status}: ${texts.statuses[machine.machineStatus]}`,
    // A count is labelled in words, and a zero is not shown (ST-008, G6).
    machine.openDefects > 0 && texts.openDefects(machine.openDefects),
    machine.overdueMaintenance > 0 && texts.overdueMaintenance(machine.overdueMaintenance),
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link href={`/team/machines/${machine.museumNumber}`} className="underline underline-offset-4">
            {machine.museumNumber} · {machine.machineModelTitle}
          </Link>
        </CardTitle>
        <CardDescription>{details.join(" · ")}</CardDescription>
      </CardHeader>
    </Card>
  );
}
