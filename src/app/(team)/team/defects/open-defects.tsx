import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterForm } from "@/components/ui/filter-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { priorities } from "@/modules/repair";
import { teamMessages } from "@/platform/messages";
import { OpenDefectEntry } from "./open-defect-entry";
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
      <DefectFilter machines={data.machines} filter={data.filter} />
      {data.entries.length === 0 ? (
        <NothingMatches filter={data.filter} />
      ) : (
        <ol className="flex flex-col gap-4 [overflow-wrap:anywhere]">
          {data.entries.map((entry) => (
            <li key={entry.id}>
              <OpenDefectEntry entry={entry} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** Machine, priority, suitable for helpers (ST-021), claimed by me (ST-025) and on hold (ST-029) – they combine; the form keeps what is chosen. */
function DefectFilter({ machines, filter }: Pick<OpenDefectsData, "machines" | "filter">) {
  // A machine the address names but the list does not offer (no open defects, or a link from elsewhere) stays chosen,
  // so the form never claims "Alle Geräte" while the list is narrowed to one.
  const unoffered =
    filter.museumNumber && !machines.some((machine) => machine.museumNumber === filter.museumNumber)
      ? filter.museumNumber
      : undefined;
  return (
    <FilterForm action="/team/defects" label={texts.filter} apply={teamMessages.filters.apply}>
      <Field>
        <FieldLabel htmlFor="machine">{terms.Machine}</FieldLabel>
        <NativeSelect id="machine" name="machine" defaultValue={filter.museumNumber ?? ""}>
          <option value="">{texts.allMachines}</option>
          {unoffered && <option value={unoffered}>{unoffered}</option>}
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
        <Checkbox name="helpers" value="1" defaultChecked={filter.suitableForHelpers} />
        {texts.onlySuitableForHelpers}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="mine" value="1" defaultChecked={filter.claimedByMe} />
        {texts.onlyClaimedByMe}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="held" value="1" defaultChecked={filter.onHold} />
        {texts.onlyOnHold}
      </label>
    </FilterForm>
  );
}

/**
 * A filter that matches nothing names what it was filtered for and offers all open defects again (G7). One filter
 * says it in its own words; several together say that nothing matches them.
 */
function NothingMatches({ filter }: { filter: OpenDefectsFilter }) {
  const { museumNumber, priority, suitableForHelpers, claimedByMe, onHold } = filter;
  const chosen = [museumNumber, priority, suitableForHelpers, claimedByMe, onHold].filter(Boolean).length;
  const text =
    chosen > 1
      ? texts.noneMatch
      : museumNumber
        ? texts.noneOfMachine(museumNumber)
        : priority
          ? texts.noneWithPriority(recordDefect.priorities[priority])
          : claimedByMe
            ? texts.noneClaimedByYou
            : onHold
              ? texts.noneOnHold
              : texts.noneSuitableForHelpers;
  return (
    <div className="flex flex-col gap-2">
      <p>{text}</p>
      <BackLink href="/team/defects">{texts.showAll}</BackLink>
    </div>
  );
}
