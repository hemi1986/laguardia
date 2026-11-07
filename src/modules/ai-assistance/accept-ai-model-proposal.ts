import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import type { CreateMachineModelInput } from "@/modules/collection";
import {
  proposedFileCategories,
  type AiModelProposalState,
  type ProposedDocument,
  type ProposedFileCategory,
} from "./ai-model-proposal";

/**
 * CMD-AcceptAiModelProposal (AGG-AiModelProposal, ST-128, ADR 0019): „Speichern“ on a written proposal's page. This is
 * the decision on the proposal itself; the machine model and the attachments of the chosen existing files are Collection's
 * commands, which the command runs in the same transaction (`runs`) – stored together or not at all. The fields of the
 * machine model obey CMD-CreateMachineModel's rules, which reject through that run; the proposal keeps what the AI
 * proposed, the fields as saved are the machine model's.
 */

/** Who may accept – technicians only, like creating a machine model by hand. */
export const acceptingActors = ["technician"] as const;
type AcceptingPerson = ActorOf<(typeof acceptingActors)[number]>;

/**
 * A document the technician chose, by its place in the proposal's documents (they never change once written). The title
 * and file category are as posted: a link's can be changed; an existing file keeps its own, so its posted ones are not used.
 */
export type ChosenDocument = { index: number; title?: string; fileCategory?: string };

export type AcceptAiModelProposalInput = {
  aiModelProposalId: string;
  /** The version the technician saw (HS-16) – a decision on a proposal saved meanwhile explains that first. */
  version: number;
  /** The fields as the technician corrected them. */
  machineModel: Omit<CreateMachineModelInput, "id">;
  /** The documents ticked, in the order posted; any number up to the proposal's documents. */
  chosen: ChosenDocument[];
};

/** What the decision must know from Collection: which of the proposal's existing files were removed meanwhile (HS-38). */
export type AcceptAiModelProposalFacts = { removedFileIds: ReadonlySet<string> };

export type AiModelProposalAccepted = {
  type: "EVT-AiModelProposalAccepted";
  aiModelProposalId: string;
  machineModelId: string;
  /** The chosen existing files – attached to the machine model in the same transaction. */
  fileIds: string[];
  /** How many chosen links wait to be loaded. */
  linkCount: number;
};

export type AcceptAiModelProposalError =
  | "ai-model-proposal-not-written"
  | "ai-model-proposal-already-accepted"
  | "ai-model-proposal-document-unknown"
  | "ai-model-proposal-document-removed";

/** The existing files of a proposal – whose removal meanwhile the command asks Collection about. */
export function existingFileIds(state: AiModelProposalState): string[] {
  return (state.documents ?? []).flatMap((document) => (document.kind === "file" ? [document.fileId] : []));
}

/** The documents the proposal's technician chose – an accepted proposal's, in the order of its documents. */
export function chosenDocuments(state: AiModelProposalState): ProposedDocument[] {
  return (state.documents ?? []).filter((document) => document.chosen);
}

export function acceptAiModelProposal(
  state: AiModelProposalState,
  input: AcceptAiModelProposalInput,
  { newId }: DecisionContext<AcceptingPerson>,
  facts: AcceptAiModelProposalFacts,
): Decision<AiModelProposalState, AiModelProposalAccepted, AcceptAiModelProposalError> {
  if (state.state === "accepted") return { ok: false, error: "ai-model-proposal-already-accepted" };
  if (state.state !== "written") return { ok: false, error: "ai-model-proposal-not-written" };
  const documents = state.documents ?? [];
  // Only documents of the proposal can be chosen; one chosen twice is the one document.
  const chosen = new Map(input.chosen.map((document) => [document.index, document]));
  if ([...chosen.keys()].some((index) => !documents[index])) {
    return { ok: false, error: "ai-model-proposal-document-unknown" };
  }
  // A chosen existing file removed since the proposal was written rejects and names the document (HS-38).
  const removed = documents.flatMap((document, index) =>
    document.kind === "file" && chosen.has(index) && facts.removedFileIds.has(document.fileId) ? [document.fileId] : [],
  );
  if (removed.length > 0) return { ok: false, error: "ai-model-proposal-document-removed", subjects: removed };

  const machineModelId = newId();
  const accepted = documents.map((document, index): ProposedDocument => {
    const choice = chosen.get(index);
    if (!choice) return document;
    if (document.kind === "file") return { ...document, chosen: true };
    const title = choice.title?.trim();
    return {
      ...document,
      title: title || document.title,
      fileCategory: fileCategoryOf(choice.fileCategory) ?? document.fileCategory,
      chosen: true,
      loading: "waiting",
    };
  });
  const acceptedProposal: AiModelProposalState = { ...state, state: "accepted", documents: accepted, machineModelId };
  const chosenOnes = chosenDocuments(acceptedProposal);
  return {
    ok: true,
    state: acceptedProposal,
    events: [
      {
        type: "EVT-AiModelProposalAccepted",
        aiModelProposalId: state.id,
        machineModelId,
        fileIds: chosenOnes.flatMap((document) => (document.kind === "file" ? [document.fileId] : [])),
        linkCount: chosenOnes.filter((document) => document.kind === "link").length,
      },
    ],
  };
}

/** One of the three file categories a proposed document may have; anything else posted is left as proposed. */
function fileCategoryOf(value: string | undefined): ProposedFileCategory | undefined {
  return proposedFileCategories.find((category) => category === value);
}
