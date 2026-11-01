import {
  aiDependencies,
  aiIndexOverview,
  aiSettingsForm,
  FILE_INDEXING_KIND,
  fileIndexingRetriedBy,
  type AiDependencies,
  type AiIndexOverview,
  type AiSettingsForm,
  type IndexingFailureReason,
} from "@/modules/ai-assistance";
import { machineLabels, machineModelTitles } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { startWhenLeftUnfinished, type LeftUnfinishedStart } from "@/app/ai-work-when-left-unfinished";

/** What the form „KI“ just did (ST-104): a save, or „Entfernen“. */
export type AiConfirmed = "saved" | "key-removed";

const savedParam: Record<AiConfirmed, string> = { saved: "ai", "key-removed": "ai-key-removed" };

/** Where the form „KI“ lands (G3) – what the page reads back. */
export function aiLanding(confirmed: AiConfirmed): string {
  return `/team/museum-settings?saved=${savedParam[confirmed]}`;
}

/** A failed file as the overview lists it: what it belongs to – a museum number or a machine model's title – and why. */
export type ShownFailedFile = {
  fileId: string;
  owner: string;
  title: string;
  reason: IndexingFailureReason;
  version: number;
};

/** The overview „KI-Erfassung“ (ST-109) with its failed files named. */
export type ShownAiIndexOverview = Omit<AiIndexOverview, "failed"> & { failed: ShownFailedFile[] };

export type AiSettingsData = {
  form: AiSettingsForm;
  confirmed: AiConfirmed | undefined;
  /** None while AI is off (user, 2026-10-31). */
  overview: ShownAiIndexOverview | undefined;
  /** The file the technician just tried again (G3) – its title. */
  retried: string | undefined;
};

/** Names the failed files' owners – Collection's machine labels and machine model titles (the page composes, ST-009). */
async function shownOverview(db: Database, overview: AiIndexOverview): Promise<ShownAiIndexOverview> {
  const machineIds = overview.failed.flatMap(({ owner }) => ("machineId" in owner ? [owner.machineId] : []));
  const machineModelIds = overview.failed.flatMap(({ owner }) => ("machineModelId" in owner ? [owner.machineModelId] : []));
  const [machines, machineModels] = await Promise.all([
    machineLabels(db, machineIds),
    machineModelTitles(db, machineModelIds),
  ]);
  // A file's owner is registered (foreign keys) – a missing one is a bug, never a blank (`named`).
  const ownerOf = (owner: AiIndexOverview["failed"][number]["owner"]) => {
    const label =
      "machineId" in owner ? machines.get(owner.machineId)?.museumNumber : machineModels.get(owner.machineModelId);
    if (label === undefined) throw new Error("A failed file's machine or machine model is missing");
    return label;
  };
  return {
    ...overview,
    failed: overview.failed.map(({ owner, ...file }) => ({ ...file, owner: ownerOf(owner) })),
  };
}

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
  const [form, overview, retried] = await Promise.all([
    aiSettingsForm(db, dependencies),
    aiIndexOverview(db, dependencies),
    typeof params.retried === "string" ? fileIndexingRetriedBy(db, params.retried, viewer) : undefined,
  ]);
  const confirmed =
    params.saved === savedParam.saved
      ? "saved"
      : params.saved === savedParam["key-removed"] && !form.keyLastFour
        ? "key-removed"
        : undefined;
  return { form, confirmed, overview: overview && (await shownOverview(db, overview)), retried: retried?.title };
}

/**
 * What opening „Einstellungen“ does (HS-35, ST-109): with AI on – the overview is shown – it starts a run of the AI
 * work after its response when a file's indexing was left unfinished, never otherwise, so opening it does not start
 * work on every load. Answers whether it did. The page passes the real start; a test passes its own.
 */
export function startAiWorkOnOpening(data: AiSettingsData, starter: LeftUnfinishedStart): Promise<boolean> {
  return data.overview ? startWhenLeftUnfinished(starter, FILE_INDEXING_KIND) : Promise.resolve(false);
}
