"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { Design } from "../design";
import { switchDesign } from "./design-action";

/**
 * The entry under „Mehr“ that switches the device to the other design (ST-090, G26) – a small form, so it works without
 * JavaScript. It posts the address of the page it is on, search included, so the switch lands on the same page with the
 * same filter. Text typed into a form on the page but not sent is lost, as with any other way off the page.
 */
export function DesignSwitch({ to, label, className }: { to: Design; label: string; className: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <form action={switchDesign}>
      <input type="hidden" name="design" value={to} />
      <input type="hidden" name="back" value={search ? `${pathname}?${search}` : pathname} />
      <button type="submit" className={`cursor-pointer ${className}`}>
        {label}
      </button>
    </form>
  );
}
