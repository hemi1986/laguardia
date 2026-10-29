"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { keptKey } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import type { AccountActions, AccountError, TeamMemberAccount } from "@/modules/team";
import { teamMessages } from "@/platform/messages";
import type { AccountActionState, EditAccountState } from "./actions";

const { accounts, editAccount: texts, accountErrors, terms } = teamMessages;

type AccountAction = (previous: AccountActionState, formData: FormData) => Promise<AccountActionState>;

/**
 * An action on an account behind one button – deactivating, activating again. It has nothing to keep; a rejection
 * says why under the button. It stays mounted when the account no longer offers it (`offered`): the action re-renders
 * the page, and a deactivation another technician made a moment earlier must be said, not swallowed.
 */
export function AccountButtonForm({
  action: act,
  label,
  offered,
}: {
  action: AccountAction;
  label: string;
  offered: boolean;
}) {
  const [state, action, pending] = useActionState(act, null);
  if (!offered) return state ? <Rejection>{accountErrors[state.error]}</Rejection> : null;
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {label}
      </Button>
      {state && <Rejection>{accountErrors[state.error]}</Rejection>}
    </form>
  );
}

type EditedField = "name" | "username" | "role" | "newPassword";

/** The field a rejection is about – marked and pointed at the reason (G8). */
const fieldOf: Partial<Record<AccountError, EditedField>> = {
  "name-required": "name",
  "username-invalid": "username",
  "username-taken": "username",
  "password-too-short": "newPassword",
  "password-too-long": "newPassword",
  "own-password": "newPassword",
  "own-role": "role",
  "last-technician": "role",
};

/**
 * The account edit page's form (ST-088, G28, G8): name, username, role and „Neues Passwort“, filled in with the account
 * as it is, the password empty – left empty, it stays as it is. One's own account shows the role without a choice and
 * offers „Passwort ändern“ in place of a new password (`offer`, the Team module's answer). A rejection keeps every
 * value but the new password, says why above „Konto speichern“ and marks its field – with and without JavaScript.
 */
export function EditAccountForm({
  action: edit,
  account,
  offer,
}: {
  action: (previous: EditAccountState, formData: FormData) => Promise<EditAccountState>;
  account: TeamMemberAccount;
  offer: NonNullable<AccountActions["edit"]>;
}) {
  const [state, action, pending] = useActionState(edit, null);
  const rejectionId = useId();
  const hintId = useId();
  const marked = state ? fieldOf[state.error] : undefined;
  const mark = (field: EditedField) =>
    marked === field ? { "aria-invalid": true, "aria-describedby": rejectionId } : {};
  const kept = state?.values ?? account;

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field data-invalid={marked === "name" || undefined}>
        <FieldLabel htmlFor="name">{accounts.name}</FieldLabel>
        <Input key={`name-${keptKey(state)}`} id="name" name="name" required defaultValue={kept.name} {...mark("name")} />
      </Field>
      <Field data-invalid={marked === "username" || undefined}>
        <FieldLabel htmlFor="username">{accounts.username}</FieldLabel>
        <Input
          key={`username-${keptKey(state)}`}
          id="username"
          name="username"
          autoCapitalize="none"
          required
          defaultValue={kept.username}
          {...mark("username")}
        />
      </Field>
      {offer.chooseRole ? (
        <Field data-invalid={marked === "role" || undefined}>
          <FieldLabel htmlFor="role">{accounts.role}</FieldLabel>
          <NativeSelect
            key={`role-${keptKey(state)}`}
            id="role"
            name="role"
            defaultValue={kept.role ?? account.role}
            {...mark("role")}
          >
            <option value="helper">{terms.Helper}</option>
            <option value="technician">{terms.Technician}</option>
          </NativeSelect>
        </Field>
      ) : (
        <div className="flex flex-col gap-1 text-sm">
          <p>
            <span className="text-muted-foreground">{accounts.role}:</span>{" "}
            {account.role === "technician" ? terms.Technician : terms.Helper}
          </p>
          <p>{accountErrors["own-role"]}</p>
        </div>
      )}
      {offer.newPassword ? (
        <Field data-invalid={marked === "newPassword" || undefined}>
          <FieldLabel htmlFor="newPassword">{texts.newPassword}</FieldLabel>
          <Input
            key={`newPassword-${keptKey(state)}`}
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            {...mark("newPassword")}
            aria-describedby={marked === "newPassword" ? `${hintId} ${rejectionId}` : hintId}
          />
          <FieldDescription id={hintId}>{accounts.passwordHint}</FieldDescription>
        </Field>
      ) : (
        <Link href="/team/password" className="self-start text-sm underline underline-offset-4">
          {texts.changeOwnPassword}
        </Link>
      )}
      {state && (
        <div id={rejectionId}>
          <Rejection>{accountErrors[state.error]}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.save}
      </Button>
    </form>
  );
}
