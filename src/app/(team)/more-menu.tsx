"use client";

import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";

/**
 * "Mehr" in the team navigation (ST-008): a native `<details>`, so it opens without JavaScript. With JavaScript it
 * also closes again – on every page change (the layout stays mounted, so an open menu would cover the next page)
 * and on Escape, with the focus back on "Mehr".
 */
export function MoreMenu({ label, children }: { label: string; children: ReactNode }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);

  return (
    <details
      key={pathname}
      ref={menu}
      className="relative ms-auto"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !menu.current?.open) return;
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }}
    >
      <summary className="cursor-pointer list-none text-sm font-medium underline-offset-4 hover:underline">
        {label} <span aria-hidden="true">▾</span>
      </summary>
      {children}
    </details>
  );
}
