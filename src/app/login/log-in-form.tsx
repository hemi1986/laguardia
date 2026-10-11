"use client";

import { useActionState, useId } from "react";
import { keptKey } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { logInAction } from "./actions";

const { login } = teamMessages;

/**
 * The login form on the house pattern (G8, G15): a rejected login keeps the username, empties only the password and
 * says why immediately above the submit button – with and without JavaScript. A failed login marks both fields: it
 * never says which of the two was wrong. A reload shows no rejection – it lives in the action's state, not the address.
 */
export function LogInForm() {
  const [state, action, pending] = useActionState(logInAction, null);
  const rejectionId = useId();
  const failed = state?.error === "login-failed";
  const marked = { "aria-invalid": failed || undefined, "aria-describedby": failed ? rejectionId : undefined };

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field data-invalid={failed}>
        <FieldLabel htmlFor="username">{login.username}</FieldLabel>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          required
          defaultValue={state?.values.username}
          key={`username-${keptKey(state)}`}
          {...marked}
        />
      </Field>
      <Field data-invalid={failed}>
        <FieldLabel htmlFor="password">{login.password}</FieldLabel>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          key={`password-${keptKey(state)}`}
          {...marked}
        />
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{state.error === "login-locked" ? login.locked : login.failed}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {login.submit}
      </Button>
    </form>
  );
}
