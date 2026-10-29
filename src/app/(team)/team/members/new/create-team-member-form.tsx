"use client";

import { useActionState, useId } from "react";
import { keptKey } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import { teamMessages } from "@/platform/messages";
import type { AccountError } from "@/modules/team";
import { createTeamMemberAction } from "./actions";

const { accounts: texts, accountErrors, terms } = teamMessages;

/** The field a rejection is about – marked and pointed at the reason (G8). */
const fieldOf: Partial<Record<AccountError, "name" | "username" | "password">> = {
  "name-required": "name",
  "username-invalid": "username",
  "username-taken": "username",
  "password-too-short": "password",
  "password-too-long": "password",
};

/**
 * Creating a team member on the house pattern (G8): a rejection keeps the name, the username and the role, empties
 * the password and says why above the button, with the field it is about marked – with and without JavaScript.
 */
export function CreateTeamMemberForm() {
  const [state, action, pending] = useActionState(createTeamMemberAction, null);
  const rejectionId = useId();
  const hintId = useId();
  const marked = state ? fieldOf[state.error] : undefined;
  const mark = (field: "name" | "username" | "password") =>
    marked === field ? { "aria-invalid": true, "aria-describedby": rejectionId } : {};

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field data-invalid={marked === "name" || undefined}>
        <FieldLabel htmlFor="name">{texts.name}</FieldLabel>
        <Input
          key={`name-${keptKey(state)}`}
          id="name"
          name="name"
          required
          defaultValue={state?.values.name}
          {...mark("name")}
        />
      </Field>
      <Field data-invalid={marked === "username" || undefined}>
        <FieldLabel htmlFor="username">{texts.username}</FieldLabel>
        <Input
          key={`username-${keptKey(state)}`}
          id="username"
          name="username"
          autoCapitalize="none"
          required
          defaultValue={state?.values.username}
          {...mark("username")}
        />
      </Field>
      <Field data-invalid={marked === "password" || undefined}>
        <FieldLabel htmlFor="password">{texts.initialPassword}</FieldLabel>
        <Input
          key={`password-${keptKey(state)}`}
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          {...mark("password")}
          aria-describedby={marked === "password" ? `${hintId} ${rejectionId}` : hintId}
        />
        <FieldDescription id={hintId}>{texts.passwordHint}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="role">{texts.role}</FieldLabel>
        <NativeSelect key={`role-${keptKey(state)}`} id="role" name="role" defaultValue={state?.values.role ?? "helper"}>
          <option value="helper">{terms.Helper}</option>
          <option value="technician">{terms.Technician}</option>
        </NativeSelect>
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{accountErrors[state.error]}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.create}
      </Button>
    </form>
  );
}
