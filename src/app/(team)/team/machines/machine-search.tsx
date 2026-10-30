import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { teamMessages } from "@/platform/messages";

const { machines: texts } = teamMessages;

/**
 * The search for machines (ST-008), one shape wherever machines are searched (ST-092, F7): the visible label „Suche“,
 * the field with „Suchen“ beside it and the hint below the field, not inside it. A plain GET form; what the page keeps
 * along with a search (a filter) comes as hidden fields.
 */
export function MachineSearch({
  action,
  search,
  children,
}: {
  action: string;
  search: string | undefined;
  /** Hidden fields the search keeps – the filter of the page (G32). */
  children?: ReactNode;
}) {
  return (
    <form action={action} className="flex flex-col gap-2" role="search">
      <label htmlFor="search" className="text-sm font-medium">
        {texts.search}
      </label>
      <div className="flex gap-2">
        <Input id="search" name="search" type="search" defaultValue={search} aria-describedby="search-hint" />
        {children}
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          {texts.searchSubmit}
        </button>
      </div>
      <p id="search-hint" className="text-muted-foreground text-sm">
        {texts.searchHint}
      </p>
    </form>
  );
}
