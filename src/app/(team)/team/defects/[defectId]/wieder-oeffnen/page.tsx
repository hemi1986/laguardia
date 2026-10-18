import Link from "next/link";
import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { reopenDefectAction } from "./actions";
import { loadDefectForReopening } from "./reopen-defect-data";
import { ReopenDefectForm } from "./reopen-defect-form";

const { defects: texts } = teamMessages;

/**
 * „Defekt wieder öffnen“ (ST-030) – the form page of reopening a resolved defect (G21, G22): it repeats the defect and
 * its machine, and lands on the defect's page. Reached from „Wieder öffnen“ under its closing note; that only a resolved
 * defect of a machine still in the museum can be reopened is CMD-ReopenDefect's rule, shown here in place of the form.
 */
export default async function ReopenDefectPage({ params }: PageProps<"/team/defects/[defectId]/wieder-oeffnen">) {
  const member = await requireTeamMember();
  const { defectId } = await params;
  const details = await loadDefectForReopening(database(), defectId, member);

  return (
    <Page title={details ? texts.reopenTitle(details.museumNumber) : teamMessages.terms.Defect}>
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
          <ReopenDefectForm
            action={reopenDefectAction.bind(null, details.id)}
            version={details.version}
            whyNot={details.whyNot}
            museumNumber={details.museumNumber}
            machine={details.machine}
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
