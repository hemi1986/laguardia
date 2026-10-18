import Link from "next/link";
import { Page } from "@/components/page";
import { attachTargets, fileCategories, machineRecord } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { attachFileAction } from "./actions";
import { AttachFileForm } from "./attach-file-form-view";

const { machineRecord: recordTexts, attachFile: texts } = teamMessages;

/**
 * Attaching a file (ST-037) – its own page, reached from the machine record's files section (G21). Every team
 * member; also for a retired machine, whose manuals stay useful (user, 2026-10-18).
 */
export default async function AttachFilePage({ params }: PageProps<"/team/machines/[museumNumber]/datei-anhaengen">) {
  await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const record = await machineRecord(database(), museumNumber);

  return (
    <Page title={texts.title(museumNumber)}>
      {record ? (
        <AttachFileForm
          action={attachFileAction.bind(null, record.museumNumber)}
          machineId={record.id}
          museumNumber={record.museumNumber}
          machineModel={record.machineModel.title}
          fileCategories={fileCategories}
          attachTargets={attachTargets}
          texts={texts.form}
        />
      ) : (
        <p>{recordTexts.unknown(museumNumber)}</p>
      )}
      <Link
        href={`/team/machines/${encodeURIComponent(museumNumber)}`}
        className="self-start text-sm underline underline-offset-4"
      >
        {texts.back}
      </Link>
    </Page>
  );
}
