import type { Database } from "@/platform/command";
import {
  filesForAiReferences,
  machineModelCalled,
  machineModelTitles,
  type MachineCategory,
  type Technology,
} from "@/modules/collection";
import { chosenDocuments } from "./accept-ai-model-proposal";
import {
  requestRefusal,
  type AiModelProposalStateName,
  type ProposedDocument,
  type RequestAiModelProposalError,
} from "./ai-model-proposal";
import { aiModelProposals, openAiModelProposalStates } from "./ai-model-proposals";
import type { AiDependencies } from "./ai-settings";
import { requestAiModelProposalFacts } from "./request-ai-model-proposal-command";

/**
 * RM-AiModelProposals (ST-123): the section „KI-Vorschläge“ of the machine models page – every open AI model proposal
 * with its description and state, the newest first – and whether to offer „Mit KI erstellen“. The button is offered
 * only while AI is on; with AI off it is absent, not disabled, and the section shows only what is open (G37). A running
 * proposal does not take the button away: the request is rejected with the reason instead, and the form keeps what was
 * typed (G8a).
 */
export type OpenAiModelProposals = {
  requestOffered: boolean;
  proposals: { id: string; description: string; state: "requested" | "written" | "failed" | "accepted" }[];
};

export async function openAiModelProposals(db: Database, dependencies: AiDependencies): Promise<OpenAiModelProposals> {
  const [facts, open] = await Promise.all([
    requestAiModelProposalFacts(db, dependencies),
    openAiModelProposalStates(db),
  ]);
  return {
    requestOffered: requestRefusal(facts) !== "ai-model-proposal-ai-off",
    proposals: open,
  };
}

/** Why the form „Mit KI erstellen“ would refuse any description now – none when it would not. */
export async function aiModelProposalRefusal(
  db: Database,
  dependencies: AiDependencies,
): Promise<RequestAiModelProposalError | undefined> {
  return requestRefusal(await requestAiModelProposalFacts(db, dependencies), undefined);
}

/** A document on the page: an existing file the museum removed since the proposal was written is marked (HS-38). */
export type PageDocument = ProposedDocument & { removed?: true };

/**
 * The AI model proposal's page: what is known of it now. The fields, sources and documents only of a written one, with
 * the version „Speichern“ posts (HS-16); the machine model and the chosen documents only of an accepted one.
 */
export type AiModelProposalPage = {
  id: string;
  description: string;
  state: AiModelProposalStateName;
  /** Written only – the version „Speichern“ posts. */
  version?: number;
  /** Written only, with the sources and documents – a field the AI could not fill (or filled with something not valid) is absent. */
  fields?: {
    title?: string;
    manufacturer?: string;
    year?: number;
    machineCategory?: MachineCategory;
    technology?: Technology;
  };
  sources?: string[];
  /** Written: all of them; accepted: the chosen ones. */
  documents?: PageDocument[];
  /** Written only – a machine model with the proposed title and manufacturer exists already (HS-39): a hint, saving stays allowed. */
  sameModel?: { id: string; title: string };
  /** Accepted only – the machine model this proposal created. */
  machineModel?: { id: string; title: string };
};

/** The AI model proposal's page (ST-123: while it is being written; ST-124: written; ST-128: accepted; ST-126: failed). */
export async function aiModelProposalPage(db: Database, id: string): Promise<AiModelProposalPage | undefined> {
  const loaded = await aiModelProposals.load(db, id);
  if (!loaded) return undefined;
  const { state: proposal, version } = loaded;
  const base = { id: proposal.id, description: proposal.description, state: proposal.state };
  if (proposal.state === "accepted") {
    const { machineModelId } = proposal;
    const machineModelTitle = machineModelId ? (await machineModelTitles(db, [machineModelId])).get(machineModelId) : undefined;
    return {
      ...base,
      documents: chosenDocuments(proposal),
      ...(machineModelId &&
        machineModelTitle !== undefined && { machineModel: { id: machineModelId, title: machineModelTitle } }),
    };
  }
  if (proposal.state !== "written") return base;
  const { title, manufacturer, year, machineCategory, technology } = proposal;
  const documents = proposal.documents ?? [];
  const files = await filesForAiReferences(
    db,
    documents.flatMap((document) => (document.kind === "file" ? [document.fileId] : [])),
  );
  const sameModel = title && manufacturer ? await machineModelCalled(db, title, manufacturer) : undefined;
  return {
    ...base,
    version,
    fields: {
      ...(title !== undefined && { title }),
      ...(manufacturer !== undefined && { manufacturer }),
      ...(year !== undefined && { year }),
      ...(machineCategory !== undefined && { machineCategory }),
      ...(technology !== undefined && { technology }),
    },
    sources: proposal.sources ?? [],
    documents: documents.map(
      (document): PageDocument =>
        document.kind === "file" && files.get(document.fileId)?.removed ? { ...document, removed: true } : document,
    ),
    ...(sameModel && { sameModel }),
  };
}
