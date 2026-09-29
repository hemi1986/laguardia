import type { ReactNode } from "react";

/**
 * A form field: its label wraps the control, so the label is programmatically associated without an id
 * (`getByLabel` finds the control). Anything else inside the label would become part of the accessible name,
 * so a description belongs next to the field, not in here.
 * Texts come in as props – the message catalogs stay in the pages (engineering conventions, "UI texts").
 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
