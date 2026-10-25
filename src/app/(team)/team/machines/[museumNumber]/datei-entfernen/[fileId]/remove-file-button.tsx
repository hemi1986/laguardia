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
 * JavaScript. A refusal – the file was removed meanwhile – takes the place of „Endgültig entfernen“ (G11).
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
  const shownRefusal = state ? commandErrorText(teamMessages, state.error) : refusal;

  return (
    <form action={action} className="flex flex-col gap-2">
      <VersionField version={version} />
      {shownRefusal && <Rejection>{shownRefusal}</Rejection>}
      <div className="flex flex-wrap items-start gap-2">
        {!shownRefusal && (
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
