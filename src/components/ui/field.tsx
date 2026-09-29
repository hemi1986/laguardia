import type { ReactNode } from "react";

/**
 * A form field: its label wraps the control, so the label is programmatically associated without an id
 * (`getByLabel` finds the control). The hint sits inside the label and becomes part of the accessible name.
 * Texts come in as props – the message catalogs stay in the pages (engineering conventions, "UI texts").
 */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
      {hint && <span className="text-muted-foreground text-xs font-normal">{hint}</span>}
    </label>
  );
}
