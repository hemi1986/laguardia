import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { teamMessages } from "@/platform/messages";
import type { HelperDashboardData } from "./helper-dashboard-data";

const { helperDashboard: texts } = teamMessages;

/**
 * The helper dashboard (RM-HelperDashboard, ST-049, owner of the page – G18): what a helper can do right now.
 */
export function HelperDashboard({ data }: { data: HelperDashboardData }) {
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle>{texts.suitableForHelpers}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-4 [overflow-wrap:anywhere]">
            {data.suitableForHelpers.map((defect) => (
              <li key={defect.id}>
                <article className="flex flex-col gap-1 text-sm">
                  <Link href={`/team/defects/${defect.id}`} className="font-medium underline underline-offset-4">
                    {defect.title}
                  </Link>
                  <p className="text-muted-foreground">
                    {defect.museumNumber} · {defect.machineModelTitle}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
