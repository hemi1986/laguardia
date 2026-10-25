"use client";

import Link from "next/link";
import { useActionState } from "react";
import { VersionField } from "@/app/_actions/form-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages } from "@/platform/messages";
import type { RemoveFileState } from "./actions";

const { removeFile: texts } = teamMessages;

/**
 * The two buttons under the question (G10b): „Endgültig entfernen“ posts the version of the file the page showed and
 * carries the removal out; „Zurück“ is a link back to the machine record and changes nothing. Works without
 * JavaScript. A refusal – the file was removed meanwhile – takes the place of „Endgültig entfernen“ (G11); after a
 * conflict the button stays, and the re-rendered page posts the version stored now.
 */
export function RemoveFileButton({
  action: run,
  version,
  refusal,
  back,
}: {
  action: (previous: RemoveFileState, formData: FormData) => Promise<RemoveFileState>;
  version: number;
  refusal?: string;
  back: string;
}) {
  const [state, action, pending] = useActionState(run, null);
  // The refusal is the page's answer now; a rejection (a conflict) keeps the button, posting the version shown now.
  const shownRefusal = refusal ?? (state ? commandErrorText(teamMessages, state.error) : undefined);

  return (
    <form action={action} className="flex flex-col gap-2">
      <VersionField version={version} />
      {shownRefusal && <Rejection>{shownRefusal}</Rejection>}
      <div className="flex flex-wrap items-start gap-2">
        {!refusal && (
          <Button type="submit" variant="destructive" disabled={pending}>
            {texts.confirm}
          </Button>
        )}
        <Link href={back} className={buttonVariants({ variant: "outline" })}>
          {texts.back}
        </Link>
      </div>
    </form>
  );
}
