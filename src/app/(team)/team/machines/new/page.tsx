import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { loadRegistration } from "./register-machine-data";
import { RegisterMachineForm } from "./register-machine-form";

const { machines: texts } = teamMessages;

/**
 * Registering a machine (ST-007) – a page with nothing but the form (G2a), its maintenance tasks chosen in the same form
 * (ST-097); technicians only (G11).
 */
export default async function RegisterMachinePage() {
  await requireTechnician();
  const choices = await loadRegistration(database());

  return (
    <Page title={texts.register}>
      {choices.machineModels.length === 0 ? (
        <>
          <p>{texts.noMachineModels}</p>
          <Link href="/team/machine-models" className={buttonVariants({ className: "self-start" })}>
            {texts.toMachineModels}
          </Link>
        </>
      ) : (
        <RegisterMachineForm {...choices} />
      )}
      <BackLink href="/team/machines">{texts.back}</BackLink>
    </Page>
  );
}
