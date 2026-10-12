"use client";

import { useActionState, useId } from "react";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import type { ActiveTeamMember } from "@/modules/team";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import type { AssignDefectState } from "./actions";

const { defects: texts, terms } = teamMessages;

const roles = { helper: terms.Helper, technician: terms.Technician } as const;

/** The rejections that are about the chosen team member – marked at the field (G8). */
const aboutTheTeamMember: readonly TeamCommandErrorCode[] = [
  "team-member-required",
  "team-member-not-active",
  "not-suitable-for-helpers",
  "already-claimed-by-them",
];

/**
 * The form „Defekt zuweisen“ (ST-026): only the team member, chosen from those the defect can be assigned to (G11) – a
 * native select, so it works without JavaScript. A rejection keeps the choice and marks the field when the choice is
 * the reason (G8). Someone who could not assign the defect when the page loaded sees the reason instead of a form –
 * but a defect that changed while they chose keeps the form and the rejection.
 */
export function AssignDefectForm({
  action: assign,
  version,
  teamMembers,
  whyNot,
}: {
  action: (previous: AssignDefectState, formData: FormData) => Promise<AssignDefectState>;
  version: number;
  teamMembers: ActiveTeamMember[];
  /** Why the team member may not assign the defect as it is now – CMD-ClaimDefect's own reason (G11). */
  whyNot: TeamCommandErrorCode | undefined;
}) {
  const [state, action, pending] = useActionState(assign, null);
  const rejectionId = useId();
  if (whyNot && !state) return <p>{commandErrorText(teamMessages, whyNot)}</p>;
  if (teamMembers.length === 0 && !state) return <p>{texts.assignToNobody}</p>;
  const invalid = !!state && aboutTheTeamMember.includes(state.error);

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="assignTo">{texts.assignTo}</FieldLabel>
        <NativeSelect
          id="assignTo"
          name="assignTo"
          defaultValue={state?.values.assignTo ?? ""}
          key={`assignTo-${keptKey(state)}`}
          required
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? rejectionId : undefined}
        >
          <option value="">{texts.assignChoose}</option>
          {teamMembers.map(({ id, name, role }) => (
            <option key={id} value={id}>
              {texts.assignee(name, roles[role])}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.assign}
      </Button>
    </form>
  );
}
