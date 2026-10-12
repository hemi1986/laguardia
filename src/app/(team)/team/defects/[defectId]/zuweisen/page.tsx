import Link from "next/link";
import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { claimantText } from "../../../claimant";
import { assignDefectAction } from "./actions";
import { loadDefectForAssigning } from "./assign-defect-data";
import { AssignDefectForm } from "./assign-defect-form";

const { defects: texts } = teamMessages;

/**
 * „Defekt zuweisen“ (ST-026) – the form page of assigning a defect (G21, G22): it repeats the defect, its machine and
 * who has claimed it, and lands on the defect's page. Reached from „Verwalten“ by technicians; that only they may
 * assign is CMD-ClaimDefect's rule, shown here in place of the form to anyone else (G11).
 */
export default async function AssignDefectPage({ params }: PageProps<"/team/defects/[defectId]/zuweisen">) {
  const member = await requireTeamMember();
  const { defectId } = await params;
  const details = await loadDefectForAssigning(database(), defectId, member);

  return (
    <Page title={details ? texts.assignTitle(details.museumNumber) : teamMessages.terms.Defect}>
      {!details ? (
        <p>{texts.unknown}</p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{details.title}</h2>
            <p className="text-muted-foreground text-sm">
              {details.museumNumber} · {details.machineModelTitle}
            </p>
            {details.claimant && <p className="text-sm">{claimantText(details.claimant)}</p>}
          </div>
          <AssignDefectForm
            action={assignDefectAction.bind(null, details.id)}
            version={details.version}
            teamMembers={details.teamMembers}
            whyNot={details.whyNot}
          />
        </>
      )}
      <Link
        href={details ? `/team/defects/${details.id}` : "/team/defects"}
        className="self-start text-sm underline underline-offset-4"
      >
        {details ? texts.backToDefect : texts.back}
      </Link>
    </Page>
  );
}
