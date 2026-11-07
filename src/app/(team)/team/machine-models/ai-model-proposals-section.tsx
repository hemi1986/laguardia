import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import type { OpenAiModelProposals } from "@/modules/ai-assistance";
import { teamMessages } from "@/platform/messages";
import { aiModelProposalAddress } from "./mit-ki-erstellen/request-ai-model-proposal-definition";

const { aiModelProposals: texts } = teamMessages;

/**
 * „Mit KI erstellen“ and the section „KI-Vorschläge“ on the machine models page (ST-123, RM-AiModelProposals): the
 * button leads to the request's own page (G2a) and is absent – not disabled – while AI is off (G37); the section is
 * shown only for what is open, one line per proposal with its description, its state and a link to its page.
 */
export function AiModelProposalsSection({ data }: { data: OpenAiModelProposals }) {
  return (
    <>
      {data.requestOffered && (
        <Link href="/team/machine-models/mit-ki-erstellen" className={buttonVariants({ className: "self-start" })}>
          {texts.create}
        </Link>
      )}
      {data.proposals.length > 0 && (
        <Section title={texts.section}>
          <ul className="flex flex-col gap-3">
            {data.proposals.map((proposal) => (
              <li key={proposal.id} className="flex flex-col gap-1">
                <Link href={aiModelProposalAddress(proposal.id)} className="underline underline-offset-4">
                  {proposal.description}
                </Link>
                <span className="text-muted-foreground text-sm">{texts.states[proposal.state]}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
