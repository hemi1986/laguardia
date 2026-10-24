import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { teamMessages } from "@/platform/messages";
import type { OpenDefectsItem } from "./defects/open-defects-data";
import type { HelperDashboardData } from "./helper-dashboard-data";

const { helperDashboard: texts } = teamMessages;

/**
 * The helper dashboard (RM-HelperDashboard, ST-049, owner of the page – G18): what a helper can do right now. Section 1
 * lists the defects they claim, section 2 the open defects suitable for helpers – each with its title and machine,
 * leading to the defect's page.
 */
export function HelperDashboard({ data }: { data: HelperDashboardData }) {
  return (
    <>
      {/* Section 1 – the defects the helper claims. */}
      <DefectsSection title={texts.claimedByYou} defects={data.claimedByYou} />
      {/* Section 2 – open defects suitable for helpers. */}
      <DefectsSection title={texts.suitableForHelpers} defects={data.suitableForHelpers} />
    </>
  );
}

function DefectsSection({ title, defects }: { title: string; defects: OpenDefectsItem[] }) {
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-4 [overflow-wrap:anywhere]">
            {defects.map((defect) => (
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
