import type { ReactNode } from "react";

/**
 * The one place the phone rules live (Definition of Done: every page works at 360 px): single column, page
 * padding, a maximum width so it stays readable on a workshop PC, and long words wrap instead of widening the
 * page. Pages set no padding, width or column layout of their own; the team shell uses `pageWidth` so its
 * navigation lines up with the page below it.
 */
export const pageWidth = "mx-auto w-full max-w-sm p-4";

/**
 * A list page may use more of a workshop PC's width, so long texts stop wrapping – still one column, one layout
 * (UX guideline O2, decided 2026-10-02). The team navigation uses it, so it lines up with the widest page.
 */
export const widePageWidth = "mx-auto w-full max-w-2xl p-4";

export function Page({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return (
    <main className={`${wide ? widePageWidth : pageWidth} flex flex-col gap-6 break-words`}>
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}
