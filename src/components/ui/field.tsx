import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

/**
 * A form field: its label wraps the control, so the label is programmatically associated without an id
 * (`getByLabel` finds the control). Anything else inside the label would become part of the accessible name,
 * so a description (e.g. a password hint) is rendered next to the label and linked to the control with
 * `aria-describedby` – the control is then the one element `children`.
 * Texts come in as props – the message catalogs stay in the pages (engineering conventions, "UI texts").
 */
export function Field({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  const descriptionId = useId();
  const control =
    description && isValidElement(children)
      ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": descriptionId })
      : children;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {label}
        {control}
      </label>
      {description && (
        <p id={descriptionId} className="text-muted-foreground text-sm">
          {description}
        </p>
      )}
    </div>
  );
}
