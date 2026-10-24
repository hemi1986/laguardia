import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { teamMessages } from "@/platform/messages";
import type { OpenDefectsItem } from "./defects/open-defects-data";
import type { HelperDashboardData } from "./helper-dashboard-data";

const { helperDashboard: texts, dueMaintenance: dueMaintenanceTexts } = teamMessages;

/**
 * The helper dashboard (RM-HelperDashboard, ST-049, owner of the page – G18): what a helper can do right now. Section 1
 * lists the defects they claim, section 2 the open defects suitable for helpers – each with its title and machine,
 * leading to the defect's page; section 3 says on how many machines each maintenance task suitable for helpers is due, in
 * words, and leads to the due maintenance list without repeating it (G18, G4a). Nothing open is the good state, and it
 * says so (G7).
 */
export function HelperDashboard({ data }: { data: HelperDashboardData }) {
  const { claimedByYou, suitableForHelpers, dueMaintenance } = data;
  if (claimedByYou.length === 0 && suitableForHelpers.length === 0 && dueMaintenance.length === 0) {
    return <p>{texts.nothingOpen}</p>;
  }
  return (
    <>
      {/* Section 1 – the defects the helper claims. */}
      <DefectsSection title={texts.claimedByYou} none={texts.noneClaimed} defects={claimedByYou} />
      {/* Section 2 – open defects suitable for helpers. */}
      <DefectsSection title={texts.suitableForHelpers} none={texts.noneSuitable} defects={suitableForHelpers} />
      {/* Section 3 – due maintenance tasks suitable for helpers, as counts. */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>{texts.dueMaintenance}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {dueMaintenance.length === 0 ? (
              <p className="text-sm">{dueMaintenanceTexts.nothingDueForHelpers}</p>
            ) : (
              <>
                <ul className="flex flex-col gap-1 text-sm [overflow-wrap:anywhere]">
                  {dueMaintenance.map((task) => (
                    <li key={task.name}>{texts.due(task.name, task.machineCount, task.overdueCount)}</li>
                  ))}
                </ul>
                <Link
                  href="/team/maintenance?helpers=1"
                  className={buttonVariants({ variant: "outline", className: "self-start" })}
                >
                  {texts.openDueMaintenance}
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

/** A section of defects – or, when it has none, a short sentence of its own (G7, ST-048's pattern). */
function DefectsSection({ title, none, defects }: { title: string; none: string; defects: OpenDefectsItem[] }) {
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {defects.length === 0 ? (
            <p className="text-sm">{none}</p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </section>
  );
}
