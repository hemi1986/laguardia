import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterForm } from "@/components/ui/filter-form";
import type { TeamMemberAccount } from "@/modules/team";
import { teamMessages } from "@/platform/messages";

const { accounts: texts, terms } = teamMessages;

/**
 * The team members list (ST-081): one entry per team member with what tells them apart – name, username, role – and
 * no actions (G5); each entry leads to the team member's own page. Deactivated accounts are listed only when the
 * filter asks for them, a plain GET form so it works without JavaScript.
 */
export function TeamMembersList({
  accounts,
  deactivatedShown,
}: {
  accounts: TeamMemberAccount[];
  deactivatedShown: boolean;
}) {
  return (
    <>
      <FilterForm action="/team/members" label={texts.filter} apply={teamMessages.filters.apply}>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="deaktivierte" value="1" defaultChecked={deactivatedShown} />
          {texts.showDeactivated}
        </label>
      </FilterForm>
      <ul className="flex flex-col gap-4">
        {accounts.map((account) => (
          <li key={account.id}>
            <Card>
              <CardHeader>
                <CardTitle>
                  <Link href={`/team/members/${account.id}`} className="underline underline-offset-4">
                    {account.name}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {account.username} · {account.role === "technician" ? terms.Technician : terms.Helper}
                  {!account.active && ` · ${texts.deactivatedMark}`}
                </CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
