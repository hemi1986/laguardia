import type { ReactNode } from "react";

/**
 * The one place the phone rules live (Definition of Done: every page works at 360 px): single column, page
 * padding, a maximum width so it stays readable on a workshop PC, and long words wrap instead of widening the
 * page. Every page has the same width – a content column of at most 672 px (42rem) inside the 16 px padding, UX
 * guideline G16 as changed 2026-10-25 (ST-089) –, so going from a list to its form page does not make the page
 * jump. Pages set no padding, width or column layout of their own; the team shell uses `pageWidth` so its
 * navigation lines up with the page below it.
 */
export const pageWidth = "mx-auto w-full max-w-[calc(42rem+2rem)] p-4";

/** `above`: what stands above the title – the museum's logo on the welcome page (ST-102). */
export function Page({ title, above, children }: { title: string; above?: ReactNode; children: ReactNode }) {
  return (
    <main className={`${pageWidth} flex flex-col gap-6 break-words`}>
      {above}
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}
