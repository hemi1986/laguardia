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
  className,
  children,
  "aria-label": ariaLabel,
}: {
  title: ReactNode;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <section aria-label={ariaLabel}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className={cn("[overflow-wrap:anywhere]", className)}>{children}</CardContent>
      </Card>
    </section>
  );
}
