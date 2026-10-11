import Link from "next/link";
import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { resolveRefusal } from "@/modules/repair";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { loadDefectForForm } from "../defect-form-data";
import { resolveDefectAction } from "./actions";
import { ResolveDefectForm } from "./resolve-defect-form";

const { defects: texts } = teamMessages;

/**
 * „Defekt beheben“ (ST-028) – the form page of resolving a defect (G21): it repeats the defect and its machine, and
 * lands on the defect's page. Every team member; whether they may resolve this defect is CMD-ResolveDefect's rule.
 */
export default async function ResolveDefectPage({ params }: PageProps<"/team/defects/[defectId]/beheben">) {
  const member = await requireTeamMember();
  const { defectId } = await params;
  const details = await loadDefectForForm(database(), defectId, (defect) => resolveRefusal(defect, member));

  return (
    <Page title={details ? texts.resolveTitle(details.museumNumber) : teamMessages.terms.Defect}>
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
              renewed), and a rejection because someone resolved it first must keep the form and the note. */}
          <ResolveDefectForm
            action={resolveDefectAction.bind(null, details.id)}
            version={details.version}
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
