import Link from "next/link";
import { Page } from "@/components/page";
import { machineForTeamForm } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../../team-session";
import { UploadCheck } from "./upload-check";

const { machineRecord, uploadCheck: texts } = teamMessages;

/**
 * Checking the direct file upload (ST-085, user 2026-10-18): a file goes from the browser straight to the private
 * store for this machine, and can be opened again through a 5-minute address. Not linked – technicians open it by its
 * address for the browser tests and the check from a phone; ST-037's form for attaching files replaces it.
 */
export default async function UploadCheckPage({ params }: PageProps<"/team/machines/[museumNumber]/upload-pruefen">) {
  await requireTechnician();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const machine = await machineForTeamForm(database(), museumNumber);

  return (
    <Page title={texts.title(museumNumber)}>
      {machine ? (
        <UploadCheck machineId={machine.id} texts={texts.form} />
      ) : (
        <p>{machineRecord.unknown(museumNumber)}</p>
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
