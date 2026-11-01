import Link from "next/link";
import type { AiSettingsForm as AiSettingsReadModel, ListedModel } from "@/modules/ai-assistance";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import { Section } from "@/components/ui/section";
import { teamMessages } from "@/platform/messages";
import { AiSettingsForm, RemoveAiKeyForm, type AiSettingsFormProps, type ModelField } from "./ai-settings-form";
import { REPLACE_KEY_ADDRESS, type AiSettingsData } from "./ai-settings-data";
import { retryFileIndexingAction } from "./ai-index-actions";
import { AiIndexOverviewView, failedFileRows } from "./ai-index-overview";
import { FailedFiles } from "./retry-file-indexing-form";

const { aiSettings: texts } = teamMessages;

const tokens = new Intl.NumberFormat("de-DE");
const dollars = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/**
 * A model as OpenRouter's list on the form shows it (ST-104): „Gemini 2.5 Flash · 1.048.576 Token · 0,30 $ / 2,50 $ pro
 * Mio. Token (Eingabe / Ausgabe)“ – an embedding model with its input price only –, „· passt nicht“ at the end of one
 * that does not fit.
 */
export function modelEntry(model: ListedModel): string {
  const { input, output } = model.pricePerMillion;
  const price =
    output === undefined
      ? `${dollars.format(input)} $ ${texts.perMillion} ${texts.inputOnly}`
      : `${dollars.format(input)} $ / ${dollars.format(output)} $ ${texts.perMillion} ${texts.inputAndOutput}`;
  return [
    model.name,
    `${tokens.format(model.contextLength)} ${texts.tokens}`,
    price,
    ...(model.fits ? [] : [texts.doesNotFit]),
  ].join(" · ");
}

function modelField(saved: AiSettingsReadModel["chatModel"], offered: ListedModel[] | "unavailable"): ModelField {
  return {
    saved: saved && (saved.name ?? saved.id),
    savedId: saved?.id,
    choose:
      offered === "unavailable"
        ? "typed"
        : offered.map((model) => ({ id: model.id, entry: modelEntry(model), fits: model.fits })),
  };
}

/** What the form „KI“ gets from RM-AiSettings – strings only, for a client component. */
export function aiSettingsFormProps(
  form: AiSettingsReadModel,
  { replacingKey = false, chosen = {} }: Partial<Pick<AiSettingsData, "replacingKey" | "chosen">> = {},
): AiSettingsFormProps {
  const offered = form.offered;
  return {
    version: form.version,
    keySaved: !!form.keyLastFour,
    replacingKey,
    chosen,
    chatModel: modelField(form.chatModel, offered === "unavailable" ? offered : offered.chat),
    embeddingModel: modelField(form.embeddingModel, offered === "unavailable" ? offered : offered.embedding),
  };
}

/**
 * The section „KI“ on „Einstellungen“ (ST-104, ST-110, RM-AiSettings): whether AI is on and what is missing (G37) – a
 * saved key that can no longer be read says so –, the saved key as its last four characters with „Ersetzen“ and
 * „Entfernen“ (G36), the saved models, the form, and the reminders – a spending limit and zero data retention at
 * OpenRouter, the privacy notice.
 */
export function AiSettingsSection({ form, confirmed, overview, retried, replacingKey, chosen }: AiSettingsData) {
  const props = aiSettingsFormProps(form, { replacingKey, chosen });
  const state = form.aiOn
    ? texts.on
    : `${texts.off} ${texts.missing} ${form.missing.map((part) => texts.missingParts[part]).join(", ")}.`;
  return (
    <Section title={texts.title} id="ki" contentClassName="flex flex-col gap-4">
      {confirmed === "saved" && <Confirmation>{form.aiOn ? `${texts.saved} ${texts.on}` : texts.saved}</Confirmation>}
      {confirmed === "key-removed" && <Confirmation>{texts.keyRemoved}</Confirmation>}
      {confirmed === "key-replaced" && <Confirmation>{texts.keyReplaced}</Confirmation>}
      <p>{state}</p>
      {form.keyUnreadable && <p>{texts.keyUnreadable}</p>}
      {form.keyLastFour && (
        <div className="flex flex-col gap-2">
          <p>
            {texts.savedKey} …{form.keyLastFour}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            {!replacingKey && (
              <Link href={REPLACE_KEY_ADDRESS} className={buttonVariants({ variant: "outline" })}>
                {texts.replaceKey}
              </Link>
            )}
            <RemoveAiKeyForm version={form.version} />
          </div>
        </div>
      )}
      {props.chatModel.saved && (
        <p>
          {texts.chatModel}: {props.chatModel.saved}
        </p>
      )}
      {props.embeddingModel.saved && (
        <p>
          {texts.embeddingModel}: {props.embeddingModel.saved}
        </p>
      )}
      {form.offered === "unavailable" && (!form.chatModel || !form.embeddingModel) && <p>{texts.listUnavailable}</p>}
      <AiSettingsForm {...props} />
      <p className="text-muted-foreground text-sm">{texts.spendingLimit}</p>
      <p className="text-muted-foreground text-sm">{texts.privacyNotice}</p>
      {overview && <AiIndexOverviewView overview={overview} retried={retried} />}
      {/* Always in this place, so a rejection of „Erneut versuchen“ is said even when the file or the overview is gone. */}
      <FailedFiles action={retryFileIndexingAction} failed={failedFileRows(overview)} />
    </Section>
  );
}
