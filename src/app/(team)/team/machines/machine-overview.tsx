import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Confirmation } from "@/components/ui/message";
import type { MachineOverviewEntry, MachineOverviewQuery, MachineStatus } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";

const { machines: texts, machineModels } = teamMessages;

/** The machine statuses in the order the overview counts them – the glossary's order (user, 2026-10-01). */
const statusOrder: MachineStatus[] = ["playable", "limited", "out-of-order", "not-on-display"];

/** The address of the overview for a search and a filter – a plain link, so it works without JavaScript. */
function overviewHref({ search, machineStatus }: MachineOverviewQuery): string {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (machineStatus) params.set("machineStatus", machineStatus);
  const query = params.toString();
  return query ? `/team/machines?${query}` : "/team/machines";
}

/**
 * The machine overview (RM-MachineOverview, ST-007/ST-008): how many active machines have which machine status –
 * each count is also the filter for it –, the search, and the list sorted by museum number. Registering is a named
 * action directly under the heading (G2a), shown to technicians only (G11).
 */
export function MachineOverview({
  machines,
  counts,
  query,
  canRegister,
  registered,
}: {
  machines: MachineOverviewEntry[];
  /** Over all active machines – independent of the search and the filter (ST-008). */
  counts: Record<MachineStatus, number>;
  query: MachineOverviewQuery;
  canRegister: boolean;
  /** The machine just registered – named in the confirmation (G3). */
  registered?: MachineOverviewEntry;
}) {
  const total = statusOrder.reduce((sum, status) => sum + counts[status], 0);
  const search = query.search?.trim();

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
      {total === 0 ? (
        <p>{texts.empty}</p>
      ) : (
        <>
          <form action="/team/machines" className="flex flex-col gap-2" role="search">
            <label htmlFor="search" className="text-sm font-medium">
              {texts.search}
            </label>
            <div className="flex gap-2">
              <Input
                id="search"
                name="search"
                type="search"
                defaultValue={search}
                aria-describedby="search-hint"
              />
              {query.machineStatus && <input type="hidden" name="machineStatus" value={query.machineStatus} />}
              <button type="submit" className={buttonVariants({ variant: "outline" })}>
                {texts.searchSubmit}
              </button>
            </div>
            <p id="search-hint" className="text-muted-foreground text-sm">
              {texts.searchHint}
            </p>
          </form>
          <nav aria-label={texts.filter}>
            <ul className="flex flex-wrap gap-2">
              <FilterLink href={overviewHref({ search })} current={!query.machineStatus}>
                {texts.all} · {total}
              </FilterLink>
              {statusOrder.map((status) => (
                <FilterLink
                  key={status}
                  href={overviewHref({ search, machineStatus: status })}
                  current={query.machineStatus === status}
                >
                  {texts.statuses[status]} · {counts[status]}
                </FilterLink>
              ))}
            </ul>
          </nav>
          {machines.length === 0 ? (
            <NothingFound search={search} machineStatus={query.machineStatus} />
          ) : (
            <ul className="flex flex-col gap-4">
              {machines.map((machine) => (
                <li key={machine.id}>
                  <MachineEntry machine={machine} />
                </li>
              ))}
            </ul>
          )}
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

/** The two "nothing found" cases say what to do about them (G7). */
function NothingFound({ search, machineStatus }: MachineOverviewQuery) {
  if (search) {
    return (
      <div className="flex flex-col gap-2">
        <p>{texts.noMatch(search)}</p>
        <Link href={overviewHref({ machineStatus })} className="self-start underline underline-offset-4">
          {texts.clearSearch}
        </Link>
      </div>
    );
  }
  return <p>{texts.noneWithStatus(machineStatus ? texts.statuses[machineStatus] : "")}</p>;
}

/** What tells a machine apart from its neighbours (G5) – everything else is on its machine record (ST-009). */
function MachineEntry({ machine }: { machine: MachineOverviewEntry }) {
  const details = [
    machineModels.categories[machine.machineCategory],
    machine.technology && machineModels.technologies[machine.technology],
    machine.location,
    `${texts.status}: ${texts.statuses[machine.machineStatus]}`,
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {machine.museumNumber} · {machine.machineModelTitle}
        </CardTitle>
        <CardDescription>{details.join(" · ")}</CardDescription>
      </CardHeader>
    </Card>
  );
}
