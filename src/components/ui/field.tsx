import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

type Control = ReactElement<{ "aria-describedby"?: string }>;

/**
 * A form field: its label wraps the control, so the label is programmatically associated without an id
 * (`getByLabel` finds the control). Anything else inside the label would become part of the accessible name,
 * so a description (e.g. a password hint) is rendered next to the label and linked to the control with
 * `aria-describedby` – with a description, `children` must be the one control element (the type demands it).
 * Texts come in as props – the message catalogs stay in the pages (engineering conventions, "UI texts").
 */
export function Field(
  props:
    | { label: string; description?: undefined; children: ReactNode }
    | { label: string; description: string; children: Control },
) {
  const descriptionId = useId();
  const { label, description, children } = props;
  const control = description
    ? cloneElement(children as Control, {
        "aria-describedby": [(children as Control).props["aria-describedby"], descriptionId].filter(Boolean).join(" "),
      })
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
