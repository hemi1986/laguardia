"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { confirmEmbeddingModelAction } from "../ai-settings-actions";
import { confirmEmbeddingModelFields, type ConfirmEmbeddingModelField } from "../ai-settings-form-input";

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
  posted: Record<ConfirmEmbeddingModelField, string>;
  back: string;
}) {
  const [state, action, pending] = useActionState(confirmEmbeddingModelAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      {confirmEmbeddingModelFields.map((name) => (
        <input key={name} type="hidden" name={name} value={posted[name]} />
      ))}
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
