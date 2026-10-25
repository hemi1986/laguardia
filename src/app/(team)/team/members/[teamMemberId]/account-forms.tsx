"use client";

import { useActionState, useId } from "react";
import { keptKey } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import type { Role } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import type { AccountActionState } from "./actions";

const { account: texts, accounts, accountErrors } = teamMessages;

type AccountAction = (previous: AccountActionState, formData: FormData) => Promise<AccountActionState>;

/**
 * An action on an account behind one button – changing the role, activating again, confirming the deactivation. It
 * has nothing to keep; a rejection says why under the button. When the account no longer allows the action, its
 * `refusal` stands in place of the button – or the rejection, when this very form was refused.
 */
export function AccountButtonForm({
  action: act,
  label,
  role,
  variant = "outline",
  refusal,
}: {
  action: AccountAction;
  label: string;
  /** The role a role change sets – posted with the button. */
  role?: Role;
  variant?: "default" | "outline" | "destructive";
  refusal?: string;
}) {
  const [state, action, pending] = useActionState(act, null);
  if (refusal) return state ? <Rejection>{accountErrors[state.error]}</Rejection> : <p>{refusal}</p>;
  return (
    <form action={action} className="flex flex-col gap-2">
      {role && <input type="hidden" name="role" value={role} />}
      <Button type="submit" variant={variant} disabled={pending} className="self-start">
        {label}
      </Button>
      {state && <Rejection>{accountErrors[state.error]}</Rejection>}
    </form>
  );
}

/**
 * Resetting the password (G8): a rejection stays at the form, says why there and marks the field, which is empty –
 * a password is never echoed.
 */
export function ResetPasswordForm({ action: reset }: { action: AccountAction }) {
  const [state, action, pending] = useActionState(reset, null);
  const rejectionId = useId();
  const hintId = useId();
  const marked = state?.error === "password-too-short";

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field data-invalid={marked || undefined}>
        <FieldLabel htmlFor="password">{texts.newPassword}</FieldLabel>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          key={`password-${keptKey(state)}`}
          aria-invalid={marked || undefined}
          aria-describedby={state ? `${hintId} ${rejectionId}` : hintId}
        />
        <FieldDescription id={hintId}>{accounts.passwordHint}</FieldDescription>
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{accountErrors[state.error]}</Rejection>
        </div>
      )}
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {texts.resetPassword}
      </Button>
    </form>
  );
}
