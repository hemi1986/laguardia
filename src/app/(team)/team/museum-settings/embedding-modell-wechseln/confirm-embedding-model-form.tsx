"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { confirmEmbeddingModelAction } from "../ai-settings-actions";

const { embeddingModelChange: texts } = teamMessages;

/**
 * The two buttons under the warning (G10b without „Endgültig“ and without red – nothing is lost, G30): „Embedding-
 * Modell wechseln“ posts the models chosen on the form „KI“ at the version it showed; „Zurück“ is a link back to the
 * form and changes nothing. Works without JavaScript. A rejection – someone changed the AI settings meanwhile, the
 * model no longer fits – is said above the buttons.
 */
export function ConfirmEmbeddingModelForm({
  posted,
  back,
}: {
  posted: { version: string; chatModel: string; embeddingModel: string };
  back: string;
}) {
  const [state, action, pending] = useActionState(confirmEmbeddingModelAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="version" value={posted.version} />
      <input type="hidden" name="chatModel" value={posted.chatModel} />
      <input type="hidden" name="embeddingModel" value={posted.embeddingModel} />
      {state && <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>}
      <div className="flex flex-wrap items-start gap-2">
        <Button type="submit" disabled={pending}>
          {texts.confirm}
        </Button>
        <Link href={back} className={buttonVariants({ variant: "outline" })}>
          {texts.back}
        </Link>
      </div>
    </form>
  );
}
