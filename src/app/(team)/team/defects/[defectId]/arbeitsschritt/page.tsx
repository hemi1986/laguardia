import Link from "next/link";
import { Page } from "@/components/page";
import { MAX_WORK_LOG_PHOTOS } from "@/modules/repair";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { loadDefectForForm } from "../defect-form-data";
import { logWorkAction } from "./actions";
import { LogWorkForm } from "./log-work-form";

const { defects: texts } = teamMessages;

/**
 * „Arbeitsschritt eintragen“ (ST-024) – the form page of logging work on a defect (G21): it repeats the defect and its
 * machine, and lands on the defect's page. Every team member, on every open defect (HS-8).
 */
export default async function LogWorkPage({ params }: PageProps<"/team/defects/[defectId]/arbeitsschritt">) {
  const member = await requireTeamMember();
  const { defectId } = await params;
  const details = await loadDefectForForm(database(), defectId, member, "log-work");

  return (
    <Page title={details ? texts.logWorkTitle(details.museumNumber) : teamMessages.terms.Defect}>
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
          {/* Rendered for a defect that is no longer open too: an action re-renders this page (the session cookie is
              renewed), and a rejection because someone resolved it meanwhile must keep the form and the texts. */}
          <LogWorkForm
            action={logWorkAction.bind(null, details.id)}
            version={details.version}
            maxPhotos={MAX_WORK_LOG_PHOTOS}
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
