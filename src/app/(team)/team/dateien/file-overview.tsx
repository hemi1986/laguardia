import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { buttonVariants } from "@/components/ui/button";
import { FilterForm } from "@/components/ui/filter-form";
import { Confirmation } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import { teamMessages } from "@/platform/messages";
import { fileOverviewAddress } from "./file-overview-query";
import type { FileOverviewData, Option } from "./file-overview-data";

const { fileOverview: texts } = teamMessages;

/**
 * The file overview (RM-FileOverview, ST-117, G18): how many files match, the filters, the entries, „Zurück“ and
 * „Weiter“. Every entry is its title – the one action, leading to the file details – and what the file is; what it is
 * attached to is on the details (G18). A plain GET form and plain links: it works without JavaScript (G40).
 */
export function FileOverviewView({ overview }: { overview: FileOverviewData }) {
  return (
    <>
      {overview.removedTitle && <Confirmation>{teamMessages.removeFile.removed(overview.removedTitle)}</Confirmation>}
      {overview.empty ? (
        <>
          <p>{texts.empty}</p>
          <AddFileButton />
        </>
      ) : (
        <>
          <AddFileButton />
          {!overview.nothingFound && <p>{overview.count}</p>}
          <Filters overview={overview} />
          {overview.nothingFound ? (
            <>
              <p>{texts.nothingFound}</p>
              <BackLink href={fileOverviewAddress()}>{texts.showAll}</BackLink>
            </>
          ) : (
            <ul className="flex flex-col gap-4 [overflow-wrap:anywhere]">
              {overview.entries.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1">
                  <Link href={entry.href} className="font-medium underline underline-offset-4">
                    {entry.title}
                  </Link>
                  <span className="text-muted-foreground text-sm">{entry.line}</span>
                </li>
              ))}
            </ul>
          )}
          {(overview.previous || overview.next) && (
            <nav aria-label={texts.pages} className="flex gap-2">
              {overview.previous && (
                <Link href={overview.previous} className={buttonVariants({ variant: "outline" })}>
                  {texts.previous}
                </Link>
              )}
              {overview.next && (
                <Link href={overview.next} className={buttonVariants({ variant: "outline" })}>
                  {texts.next}
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}

/** „Datei hinzufügen“ (ST-119, G2): directly under the heading, and in the empty overview below its sentence (G7). */
function AddFileButton() {
  return (
    <Link href="/team/dateien/hinzufuegen" className={buttonVariants({ className: "self-start" })}>
      {texts.add}
    </Link>
  );
}

/** The filters (G32, G20) – one form sent with „Filtern“; sending it starts at page 1, so it carries no page. */
function Filters({ overview }: { overview: FileOverviewData }) {
  const { query } = overview;
  return (
    <FilterForm action="/team/dateien" label={texts.filter} apply={teamMessages.filters.apply}>
      <Choice name="fileCategory" label={texts.fileCategory} value={query.fileCategory} all={texts.allFileCategories}>
        <Options options={overview.fileCategories} />
      </Choice>
      <Choice name="attachedTo" label={texts.attachedTo} value={query.attachedTo} all={texts.all}>
        <option value="nowhere">{teamMessages.fileDetails.nowhere}</option>
        {overview.machines.length > 0 && (
          <optgroup label={texts.machines}>
            <Options options={overview.machines} />
          </optgroup>
        )}
        {overview.machineModels.length > 0 && (
          <optgroup label={texts.machineModels}>
            <Options options={overview.machineModels} />
          </optgroup>
        )}
      </Choice>
      {overview.aiIndexStates && (
        <Choice name="aiIndex" label={texts.aiIndex} value={query.aiIndex} all={texts.all}>
          <Options options={overview.aiIndexStates} />
        </Choice>
      )}
    </FilterForm>
  );
}

/** A native choice with its empty entry first, which stands for „no filter“ (G20). */
function Choice({
  name,
  label,
  value,
  all,
  children,
}: {
  name: string;
  label: string;
  value: string | undefined;
  all: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <NativeSelect id={name} name={name} defaultValue={value ?? ""}>
        <option value="">{all}</option>
        {children}
      </NativeSelect>
    </div>
  );
}

function Options({ options }: { options: Option[] }) {
  return options.map((option) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ));
}
