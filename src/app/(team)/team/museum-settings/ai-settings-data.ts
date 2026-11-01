import { aiDependencies, aiSettingsForm, type AiDependencies, type AiSettingsForm } from "@/modules/ai-assistance";
import type { Database } from "@/platform/command";

/** What the form „KI“ just did (ST-104): a save, or „Entfernen“. */
export type AiConfirmed = "saved" | "key-removed";

const savedParam: Record<AiConfirmed, string> = { saved: "ai", "key-removed": "ai-key-removed" };

/** Where the form „KI“ lands (G3) – what the page reads back. */
export function aiLanding(confirmed: AiConfirmed): string {
  return `/team/museum-settings?saved=${savedParam[confirmed]}`;
}

export type AiSettingsData = { form: AiSettingsForm; confirmed: AiConfirmed | undefined };

/**
 * The section „KI“'s data (ST-104): RM-AiSettings, with OpenRouter's models read now, and what was just done. Like
 * „Museum“, a save is confirmed **without the journal** – a save without a change records no event (HS-27) – and the
 * confirmation only says what the section shows. „Entfernen“ is confirmed only while no key is saved.
 */
export async function loadAiSettings(
  db: Database,
  params: Record<string, string | string[] | undefined>,
  { dependencies = aiDependencies() }: { dependencies?: AiDependencies } = {},
): Promise<AiSettingsData> {
  const form = await aiSettingsForm(db, dependencies);
  const confirmed =
    params.saved === savedParam.saved
      ? "saved"
      : params.saved === savedParam["key-removed"] && !form.keyLastFour
        ? "key-removed"
        : undefined;
  return { form, confirmed };
}
