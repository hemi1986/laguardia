import type { ReactNode } from "react";

/**
 * The one place the phone rules live (Definition of Done: every page works at 360 px): single column, page
 * padding, a maximum width so it stays readable on a workshop PC, and long words wrap instead of widening the
 * page. Pages set no padding, width or column layout of their own; the team shell uses `pageWidth` so its
 * navigation lines up with the page below it.
 */
export const pageWidth = "mx-auto w-full max-w-sm p-4";

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className={`${pageWidth} flex flex-col gap-6 break-words`}>
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}
