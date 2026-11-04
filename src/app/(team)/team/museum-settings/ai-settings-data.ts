import {
  aiDependencies,
  aiIndexOverview,
  aiSettingsForm,
  fileIndexingRetriedBy,
  type AiDependencies,
  type AiIndexOverview,
  type AiSettingsForm,
} from "@/modules/ai-assistance";
import { fileRemovedBy } from "@/modules/collection";
import type { Database } from "@/platform/command";

/** What the form „KI“ just did (ST-104): a save, „Entfernen“, or – ST-110 – „Ersetzen“ saved. */
export type AiConfirmed = "saved" | "key-removed" | "key-replaced";

const savedParam: Record<AiConfirmed, string> = {
  saved: "ai",
  "key-removed": "ai-key-removed",
  "key-replaced": "ai-key-replaced",
};

/** „Ersetzen“ next to the saved key (ST-110): a link, so the field „Neuer API-Schlüssel“ opens without JavaScript. */
export const REPLACE_KEY_ADDRESS = "/team/museum-settings?replace=key#ki";

/** Where the form „KI“ lands (G3) – what the page reads back. */
export function aiLanding(confirmed: AiConfirmed): string {
  return `/team/museum-settings?saved=${savedParam[confirmed]}`;
}

export type AiSettingsData = {
  form: AiSettingsForm;
  confirmed: AiConfirmed | undefined;
  /** None while AI is off (user, 2026-10-31). */
  overview: AiIndexOverview | undefined;
  /** The file the technician just tried again (G3) – its title. */
  retried: string | undefined;
  /** The file the technician just removed on its details (G3) – its title, from the journal. */
  removedFileTitle: string | undefined;
  /** „Ersetzen“ was tapped: the form offers the field „Neuer API-Schlüssel“ (ST-110). */
  replacingKey: boolean;
  /** The models chosen before the warning, when the technician came back from it (G10b, ST-110). */
  chosen: { chatModel?: string; embeddingModel?: string };
};

/**
 * The section „KI“'s data (ST-104): RM-AiSettings, with OpenRouter's models read now, and what was just done. Like
 * „Museum“, a save is confirmed **without the journal** – a save without a change records no event (HS-27) – and the
 * confirmation only says what the section shows. „Entfernen“ is confirmed only while no key is saved. „Erneut
 * versuchen“ on a failed file (ST-109) is confirmed by the technician's own last step on that file – the journal.
 */
export async function loadAiSettings(
  db: Database,
  params: Record<string, string | string[] | undefined>,
  { dependencies = aiDependencies(), viewer }: { dependencies?: AiDependencies; viewer: string },
): Promise<AiSettingsData> {
  const [form, overview, retried, removed] = await Promise.all([
    aiSettingsForm(db, dependencies),
    aiIndexOverview(db, dependencies),
    typeof params.retried === "string" ? fileIndexingRetriedBy(db, params.retried, viewer) : undefined,
    typeof params.fileRemoved === "string" ? fileRemovedBy(db, params.fileRemoved, viewer) : undefined,
  ]);
  const confirmed =
    params.saved === savedParam.saved
      ? "saved"
      : params.saved === savedParam["key-removed"] && !form.keyLastFour
        ? "key-removed"
        : params.saved === savedParam["key-replaced"] && form.keyLastFour
          ? "key-replaced"
          : undefined;
  const chosen = (name: string) => (typeof params[name] === "string" && params[name]) || undefined;
  return {
    form,
    confirmed,
    overview,
    retried: retried?.title,
    removedFileTitle: removed?.title,
    replacingKey: params.replace === "key" && !!form.keyLastFour,
    chosen: { chatModel: chosen("chatModel"), embeddingModel: chosen("embeddingModel") },
  };
}

/**
 * Whether opening „Einstellungen“ starts a run of the AI work after its response (HS-35, ST-109): with AI on – the
 * overview is shown – when a file's indexing was left unfinished, never otherwise, so opening it does not start work on
 * every load.
 */
export async function openingStartsAiWork(
  data: AiSettingsData,
  fileIndexingLeftUnfinished: () => Promise<boolean>,
): Promise<boolean> {
  return !!data.overview && (await fileIndexingLeftUnfinished());
}
