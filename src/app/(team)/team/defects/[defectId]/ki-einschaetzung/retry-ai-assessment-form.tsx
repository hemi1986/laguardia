"use client";

import { useActionState } from "react";
import { rejectionText } from "@/app/_actions/rejection-text";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import type { RetryAiAssessmentState } from "./retry-ai-assessment-definition";

const { aiAssessments: texts } = teamMessages;

/**
 * „Erneut versuchen“ under a failed AI assessment (ST-108): one tap asks for a new AI assessment with the failed one's
 * note and photos – no form in between. A rejection is shown at the button (G8); it works without JavaScript. The form
 * stays mounted when the offer is gone after a rejection (`offered` false but a state to show), so the reason is said
 * rather than swallowed – the pattern of `DefectButtonForm`.
 */
export function RetryAiAssessmentForm({
  action,
  offered,
}: {
  action: (previous: RetryAiAssessmentState, formData: FormData) => Promise<RetryAiAssessmentState>;
  /** Whether the person may retry now (G11) – a rejection still shows once it is there. */
  offered: boolean;
}) {
  const [state, submit, pending] = useActionState(action, null);
  if (!offered && !state) return null;
  return (
    <form action={submit} className="flex flex-col gap-2">
      {state && <Rejection>{rejectionText(state.error)}</Rejection>}
      {offered && (
        <Button type="submit" variant="outline" disabled={pending} className="self-start">
          {texts.retry}
        </Button>
      )}
    </form>
  );
}
