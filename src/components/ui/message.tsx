import type { ReactNode } from "react";

/**
 * The two message elements the pages use. They keep the roles the browser tests rely on and are rendered
 * inside the page's `<main>`: a rejection is assertive (`role="alert"`), a confirmation polite (`role="status"`).
 */
export function Rejection({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-destructive text-sm font-medium">
      {children}
    </p>
  );
}

export function Confirmation({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-sm font-medium">
      {children}
    </p>
  );
}
