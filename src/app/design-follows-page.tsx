"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { designOf, type Design } from "./design";

/**
 * Keeps the design of `<html>` right when JavaScript moves between pages (ST-090): the root layout is rendered once and
 * stays mounted, so a link from the start page (always dark) to the login (the device's choice) would keep the first
 * page's design. Without JavaScript every page is loaded anew and the root layout decides alone.
 */
export function DesignFollowsPage({ device }: { device: Design | undefined }) {
  const pathname = usePathname();
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", designOf(pathname, device) === "dark");
  }, [pathname, device]);
  return null;
}
