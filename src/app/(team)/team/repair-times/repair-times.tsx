import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { repairTimePeriods, type RepairTime } from "@/modules/repair";
import { teamMessages } from "@/platform/messages";
import type { RepairTimesData } from "./repair-times-data";

const { repairTimes: texts, recordDefect, terms } = teamMessages;

/**
 * The repair times (ST-051): the period chosen with two links – they work without JavaScript –, what is measured,
 * and per priority the two typical times, each with its number of defects (G6), or that there were none (G7).
 */
export function RepairTimesView({ period, priorities }: RepairTimesData) {
  return (
    <>
      <nav aria-label={texts.period}>
        <ul className="flex flex-wrap gap-2">
          {repairTimePeriods.map((days) => (
            <li key={days}>
              <Link
                href={`/team/repair-times?zeitraum=${days}`}
                aria-current={days === period ? "page" : undefined}
                className={buttonVariants({ variant: days === period ? "default" : "outline", size: "sm" })}
              >
                {texts.periods[days]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="text-sm">{texts.measured}</p>
      <p className="text-muted-foreground text-sm">{texts.typical}</p>
      {priorities.map(({ priority, toFirstWorkLogEntry, toResolved }) => {
        const label = texts.priority(recordDefect.priorities[priority]);
        return (
          <section key={priority} aria-label={label} className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{label}</h2>
            {!toFirstWorkLogEntry && !toResolved ? (
              <p className="text-sm">{texts.noDefects}</p>
            ) : (
              <>
                <TimeLine label={terms["Time to first work log entry"]} time={toFirstWorkLogEntry} />
                <TimeLine label={terms["Time to resolved"]} time={toResolved} />
              </>
            )}
          </section>
        );
      })}
    </>
  );
}

function TimeLine({ label, time }: { label: string; time: RepairTime | undefined }) {
  return <p className="text-sm">{time ? texts.time(label, time.median, time.defects) : texts.noDefect(label)}</p>;
}
