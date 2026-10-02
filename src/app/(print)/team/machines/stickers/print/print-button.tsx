"use client";

import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog (ST-011); the button itself is not printed. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
