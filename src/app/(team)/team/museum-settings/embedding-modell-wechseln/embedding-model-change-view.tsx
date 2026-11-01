import { BackLink } from "@/components/ui/back-link";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { ConfirmEmbeddingModelForm } from "./confirm-embedding-model-form";
import type { EmbeddingModelChangeData } from "./embedding-model-change-data";

const { embeddingModelChange: texts } = teamMessages;

const dollars = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The warning before the embedding model changes (ST-110, G10b): nothing but the question – how many files are indexed
 * again, the estimated cost, and that the AI finds only the files indexed again until then –, „Embedding-Modell
 * wechseln“ and „Zurück“. Without an estimate (OpenRouter down, an unknown model, no change) only „Zurück“.
 */
export function EmbeddingModelChangeView({ change, posted, back }: EmbeddingModelChangeData) {
  if (typeof change === "string") {
    return (
      <>
        {change !== "no-change" && <p>{commandErrorText(teamMessages, change)}</p>}
        <BackLink href={back}>{texts.back}</BackLink>
      </>
    );
  }
  // Below a cent it still says „etwa 0,00 $“ – an estimate, not a bill; the overview shows what indexing cost.
  return (
    <>
      <p className="font-medium">
        {texts.question(change.files, change.pagesAndImages, dollars.format(change.estimatedCost))}
      </p>
      <ConfirmEmbeddingModelForm posted={posted} back={back} />
    </>
  );
}
