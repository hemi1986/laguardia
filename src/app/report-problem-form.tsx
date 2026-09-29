"use client";

import { useActionState } from "react";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, type VisitorMessages } from "@/platform/messages";
import { reportProblemForTestMachine } from "./actions";

/**
 * The spike's problem report form (ST-001), run through the Server Action runner (ST-073, Q9): a rejection shows the
 * catalogue text of its error code and keeps the typed description – with and without JavaScript.
 */
export function ReportProblemForm({ messages }: { messages: VisitorMessages }) {
  const [state, action, pending] = useActionState(reportProblemForTestMachine, null);
  const { problemReport } = messages;

  return (
    <form action={action} className="flex flex-col gap-2">
      <label>
        {problemReport.label}
        <textarea
          name="description"
          required
          defaultValue={state?.values.description}
          key={state ? JSON.stringify(state) : "empty"}
          aria-invalid={state ? true : undefined}
          className="block w-full border"
        />
      </label>
      {state && <Rejection>{commandErrorText(messages, state.error)}</Rejection>}
      <button type="submit" disabled={pending}>
        {problemReport.submit}
      </button>
    </form>
  );
}
