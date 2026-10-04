import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { priorities } from "@/modules/repair";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import type { OpenDefectsData, OpenDefectsFilter } from "./open-defects-data";

const { defects: texts, recordDefect, terms } = teamMessages;

/**
 * The open defects list (RM-OpenDefects, ST-021): by priority – high first –, within a priority the oldest first. The
 * filter is a plain GET form, so it works without JavaScript. An entry shows what tells it apart (G5) and leads to the
 * defect's own page. Titles are plain text: React escapes them.
 */
export function OpenDefectsView({ data }: { data: OpenDefectsData }) {
  if (data.total === 0) {
    // Nothing to filter: say so, and where new defects come from (G7).
    return (
      <div className="flex flex-col gap-2">
        <p>{texts.none}</p>
        <Link href="/team/triage" className="self-start underline underline-offset-4">
          {texts.toTriage}
        </Link>
      </div>
    );
  }
  return (
    <>
      <p>{texts.open(data.total)}</p>
      <FilterForm machines={data.machines} filter={data.filter} />
      {data.entries.length === 0 ? (
        <NothingMatches filter={data.filter} />
      ) : (
        <ol className="flex flex-col gap-4 [overflow-wrap:anywhere]">
          {data.entries.map((entry) => (
            <li key={entry.id}>
              <article className="flex flex-col gap-1 text-sm">
                <Link href={`/team/defects/${entry.id}`} className="font-medium underline underline-offset-4">
                  {entry.title}
                </Link>
                <p>
                  {entry.museumNumber} · {entry.machineModelTitle}
                </p>
                <p className="text-muted-foreground">
                  {texts.priority(recordDefect.priorities[entry.priority])}
                  {entry.suitableForHelpers && ` · ${terms["Suitable for helpers"]}`}
                </p>
                <p className="text-muted-foreground">
                  {formatDateTime(entry.openSince)} · {texts.openFor(entry.openDays)}
                </p>
              </article>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** Machine, priority and suitable for helpers (ST-021) – they combine; the form keeps what is chosen. */
function FilterForm({ machines, filter }: Pick<OpenDefectsData, "machines" | "filter">) {
  return (
    <form action="/team/defects" role="search" aria-label={texts.filter} className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="machine">{terms.Machine}</FieldLabel>
        <NativeSelect id="machine" name="machine" defaultValue={filter.museumNumber ?? ""}>
          <option value="">{texts.allMachines}</option>
          {machines.map((machine) => (
            <option key={machine.museumNumber} value={machine.museumNumber}>
              {machine.museumNumber} · {machine.machineModelTitle}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="priority">{recordDefect.priority}</FieldLabel>
        <NativeSelect id="priority" name="priority" defaultValue={filter.priority ?? ""}>
          <option value="">{texts.allPriorities}</option>
          {priorities.map((priority) => (
            <option key={priority} value={priority}>
              {recordDefect.priorities[priority]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="helpers" value="1" defaultChecked={filter.suitableForHelpers} className="size-4" />
        {texts.onlySuitableForHelpers}
      </label>
      <button type="submit" className={`${buttonVariants({ variant: "outline" })} self-start`}>
        {texts.applyFilter}
      </button>
    </form>
  );
}

/**
 * A filter that matches nothing names what it was filtered for and offers all open defects again (G7). One filter
 * says it in its own words; several together say that nothing matches them.
 */
function NothingMatches({ filter }: { filter: OpenDefectsFilter }) {
  const { museumNumber, priority, suitableForHelpers } = filter;
  const chosen = [museumNumber, priority, suitableForHelpers].filter(Boolean).length;
  const text =
    chosen > 1
      ? texts.noneMatch
      : museumNumber
        ? texts.noneOfMachine(museumNumber)
        : priority
          ? texts.noneWithPriority(recordDefect.priorities[priority])
          : texts.noneSuitableForHelpers;
  return (
    <div className="flex flex-col gap-2">
      <p>{text}</p>
      <Link href="/team/defects" className="self-start underline underline-offset-4">
        {texts.showAll}
      </Link>
    </div>
  );
}
