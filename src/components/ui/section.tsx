import type { ReactNode } from "react";
import { cn } from "cn";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

/**
 * One section of a record or a dashboard (UX guideline G29, ST-092): a frame with its title at the top – always an
 * `<h2>` –, then its content, its empty sentence when there is nothing (G7) and its one link or button at its end. The
 * machine record's sections are the example every other page follows.
 */
export function Section({
  title,
  contentClassName,
  children,
  "aria-label": ariaLabel,
  id,
}: {
  title: ReactNode;
  /** Classes of the section's content below its title. */
  contentClassName?: string;
  children: ReactNode;
  "aria-label"?: string;
  /** An anchor a link can jump to – the form „KI“ at the end of a long settings page (ST-110). */
  id?: string;
}) {
  return (
    <section aria-label={ariaLabel} id={id}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className={cn("[overflow-wrap:anywhere]", contentClassName)}>{children}</CardContent>
      </Card>
    </section>
  );
}
