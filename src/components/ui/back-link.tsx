import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The way back or on from a page (UX guideline G17, ST-092): the small underlined link, as wide as its words – the
 * shape of „Zurück zum Gerät“ on the machine record's pages, used for every back link and every link that clears a
 * search or a filter.
 */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="self-start text-sm underline underline-offset-4">
      {children}
    </Link>
  );
}
