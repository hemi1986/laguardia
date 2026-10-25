import Link from "next/link";
import { Page } from "@/components/page";
import { attachTargets, machineRecord } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { attachPhotoAction } from "./actions";
import { AttachPhotoForm } from "./attach-photo-form-view";

const { machineRecord: recordTexts, attachPhoto: texts } = teamMessages;

/**
 * Attaching a camera photo as a file (ST-054) – its own page beside attaching a file (user, 2026-10-25), reached from
 * the machine record's files section. Every team member, like attaching a file (ST-037).
 */
export default async function AttachPhotoPage({ params }: PageProps<"/team/machines/[museumNumber]/foto-anhaengen">) {
  await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const record = await machineRecord(database(), museumNumber);

  return (
    <Page title={texts.title(museumNumber)}>
      {record ? (
        <AttachPhotoForm
          action={attachPhotoAction.bind(null, { id: record.id, museumNumber: record.museumNumber })}
          museumNumber={record.museumNumber}
          machineModel={record.machineModel.title}
          attachTargets={attachTargets}
          texts={{
            ...texts.form,
            photo: {
              ...texts.form.photo,
              tooLarge: teamMessages.commandErrors["too-large"],
              notAnImage: teamMessages.commandErrors["not-an-image"],
            },
          }}
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
