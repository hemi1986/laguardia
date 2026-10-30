import type { ReactNode } from "react";
import { buttonVariants } from "./button";

/**
 * A list's filter (UX guideline G32, ST-092): a plain GET form – it works without JavaScript –, its fields, then the
 * button that applies them, as wide as its words. The same shape on every list; the button's text comes from the page.
 */
export function FilterForm({
  action,
  label,
  apply,
  children,
}: {
  action: string;
  /** Names the form for a screen reader when the page has more than one form. */
  label?: string;
  /** The button's text – „Filtern“ (G32). */
  apply: string;
  children: ReactNode;
}) {
  return (
    <form action={action} method="get" aria-label={label} className="flex flex-col gap-3">
      {children}
      <button type="submit" className={buttonVariants({ variant: "outline", className: "self-start" })}>
        {apply}
      </button>
    </form>
  );
}
