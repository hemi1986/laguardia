"use client";

import Link from "next/link";
import { useActionState } from "react";
import { VersionField } from "@/app/_actions/form-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages } from "@/platform/messages";
import type { ReleaseClaimState } from "./actions";
import { longLabel } from "./defect-button-form";

type ReleaseAction = (previous: ReleaseClaimState, formData: FormData) => Promise<ReleaseClaimState>;

const noAction: ReleaseAction = async () => null;

/**
 * „Verwalten“ on a defect's page (G22): what manages the defect rather than works on it, for technicians, behind one
 * fold – a native `<details>`, so it opens without JavaScript, in G22's order. „Zuweisen“ and „Priorität ändern“ lead
 * to their form pages (G21, ST-026, ST-027), as does „Titel und Eignung ändern“ (ST-031); „Übernahme von Tom aufheben“ is one tap and posts the version the page
 * showed (ST-026). A rejection of that tap opens the fold, so
 * it is never hidden (G8).
 */
export function ManageDefect({
  assignHref,
  release,
  prioritizeHref,
  changeDetailsHref,
}: {
  /** The form page of assigning the defect – none when it cannot be assigned. */
  assignHref: string | undefined;
  /**
   * Releasing someone else's claim – none where the page is only looked at. `offered` says whether there is such a
   * claim the team member may release (G11); the form stays without it while it has a rejection to show.
   */
  release: { action: ReleaseAction; version: number; label: string; offered: boolean } | undefined;
  /** The form page of changing the defect's priority – none when it cannot be prioritized. */
  prioritizeHref: string | undefined;
  /** The form page of changing the defect's title or suitable-for-helpers mark – none when they cannot be changed. */
  changeDetailsHref: string | undefined;
}) {
  const { defects: texts } = teamMessages;
  const [state, action, pending] = useActionState(release?.action ?? noAction, null);
  if (!assignHref && !release?.offered && !prioritizeHref && !changeDetailsHref && !state) return null;

  return (
    <details open={state ? true : undefined} className="mt-2">
      <summary className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline">
        {texts.manage}
      </summary>
      <div className="mt-3 flex flex-col items-start gap-3">
        {assignHref && (
          <Link href={assignHref} className={buttonVariants({ variant: "outline" })}>
            {texts.assign}
          </Link>
        )}
        {release && (release.offered || state) && (
          <form action={action} className="flex max-w-full flex-col items-start gap-2">
            <VersionField version={release.version} />
            {state && <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>}
            {release.offered && (
              <Button type="submit" variant="outline" disabled={pending} className={longLabel}>
                {release.label}
              </Button>
            )}
          </form>
        )}
        {prioritizeHref && (
          <Link href={prioritizeHref} className={buttonVariants({ variant: "outline" })}>
            {texts.prioritize}
          </Link>
        )}
        {changeDetailsHref && (
          <Link href={changeDetailsHref} className={buttonVariants({ variant: "outline" })}>
            {texts.changeDetails}
          </Link>
        )}
      </div>
    </details>
  );
}
