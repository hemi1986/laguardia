import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { loadEmbeddingModelChange } from "./embedding-model-change-data";
import { EmbeddingModelChangeView } from "./embedding-model-change-view";

/**
 * „Embedding-Modell wechseln“ (ST-110): the warning a save of the form „KI“ leads to when it changes the saved
 * embedding model – a page of its own, so it works without JavaScript (G10b). Technicians only.
 */
export default async function EmbeddingModelChangePage({
  searchParams,
}: PageProps<"/team/museum-settings/embedding-modell-wechseln">) {
  await requireTechnician();
  const data = await loadEmbeddingModelChange(database(), await searchParams);
  return (
    <Page title={teamMessages.embeddingModelChange.title}>
      <EmbeddingModelChangeView {...data} />
    </Page>
  );
}
