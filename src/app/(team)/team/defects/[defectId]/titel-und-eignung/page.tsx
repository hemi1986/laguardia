import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { changeDefectDetailsAction } from "./actions";
import { loadDefectForChangingDetails } from "./change-defect-details-data";
import { ChangeDefectDetailsForm } from "./change-defect-details-form";

const { defects: texts } = teamMessages;

/**
 * „Titel und Eignung ändern“ (ST-031) – the form page of changing a defect's title or suitable-for-helpers mark (G21,
 * G22): it repeats the defect and its machine, and lands on the defect's page. Reached from „Verwalten“ by technicians;
 * that only they may change it, and only an open defect, is CMD-ChangeDefectDetails's rule, shown here in place of the
 * form (G11).
 */
export default async function ChangeDefectDetailsPage({
  params,
}: PageProps<"/team/defects/[defectId]/titel-und-eignung">) {
  const member = await requireTeamMember();
  const { defectId } = await params;
  const details = await loadDefectForChangingDetails(database(), defectId, member);

  return (
    <Page title={details ? texts.changeDetailsTitle(details.museumNumber) : teamMessages.terms.Defect}>
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
          <ChangeDefectDetailsForm
            action={changeDefectDetailsAction.bind(null, details.id)}
            version={details.version}
            title={details.title}
            suitableForHelpers={details.suitableForHelpers}
            releasesClaimOf={details.releasesClaimOf}
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
