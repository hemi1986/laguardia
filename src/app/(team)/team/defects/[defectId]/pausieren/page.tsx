import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { holdReasons } from "@/modules/repair";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { loadDefectForForm } from "../defect-form-data";
import { putDefectOnHoldAction } from "./actions";
import { PutDefectOnHoldForm } from "./put-defect-on-hold-form";

const { defects: texts } = teamMessages;

/**
 * „Defekt pausieren“ (ST-029) – the form page of putting a defect on hold (G21, G22): it repeats the defect and its
 * machine, and lands on the defect's page. Reached from „Pausieren“ in the work group; that only technicians and the
 * claimant may, and only an open defect not on hold, is CMD-PutDefectOnHold's rule, shown here in place of the form (G11).
 */
export default async function PutDefectOnHoldPage({ params }: PageProps<"/team/defects/[defectId]/pausieren">) {
  const member = await requireTeamMember();
  const { defectId } = await params;
  const details = await loadDefectForForm(database(), defectId, member, "put-on-hold");

  return (
    <Page title={details ? texts.putOnHoldTitle(details.museumNumber) : teamMessages.terms.Defect}>
      {!details ? (
        <p>{texts.unknown}</p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{details.title}</h2>
            <p className="text-muted-foreground text-sm">
              {details.museumNumber} · {details.machineModelTitle}
            </p>
          </div>
          <PutDefectOnHoldForm
            action={putDefectOnHoldAction.bind(null, details.id)}
            version={details.version}
            reasons={holdReasons}
            whyNot={details.whyNot}
          />
        </>
      )}
      <BackLink href={details ? `/team/defects/${details.id}` : "/team/defects"}>
        {details ? texts.backToDefect : texts.back}
      </BackLink>
    </Page>
  );
}
