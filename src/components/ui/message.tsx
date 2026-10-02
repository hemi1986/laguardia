import { CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The two message elements the pages use. They keep the roles the browser tests rely on and are rendered
 * inside the page's `<main>`: a rejection is assertive (`role="alert"`), a confirmation polite (`role="status"`).
 * Each carries an icon, so it is recognisable without colour (UX guideline G9); the icon is decoration only.
 */
export function Rejection({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-destructive flex items-start gap-2 text-sm font-medium">
      <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function Confirmation({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-2 text-sm font-medium">
      <CircleCheck aria-hidden="true" className="mt-px size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
