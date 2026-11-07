import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import type { FileContent } from "@/modules/collection";
import type { AiModelProposalState, DocumentFailureReason, ProposedDocument } from "./ai-model-proposal";

/**
 * CMD-LoadProposedDocument (AGG-AiModelProposal, ST-129, ADR 0019): the result of loading one chosen link of an accepted
 * proposal, recorded by the background work as the system – once per link, in its own transaction. The fetch itself
 * happens before, outside any transaction (the web-fetch seam); this is the decision on the proposal: the link was loaded
 * (it becomes a file of the machine model, added by CMD-AddFile in the same transaction) or failed with one reason. Only a
 * link still waiting is recorded – a late result after it was failed as *broken off* records nothing (rule).
 */

/** Only the background work records a result. */
export const loadingActors = ["system"] as const;

export type LoadProposedDocumentInput = {
  aiModelProposalId: string;
  /** The link's place in the proposal's documents (they never change once written). */
  index: number;
  outcome:
    | {
        kind: "loaded";
        /** The content already in the private store, with its size and media type. */
        content: FileContent;
        /** The name the content had on the web – the last part of the address, if it has one. */
        originalFileName?: string;
      }
    | { kind: "failed"; reason: DocumentFailureReason };
};

export type ProposedDocumentLoaded = {
  type: "EVT-ProposedDocumentLoaded";
  aiModelProposalId: string;
  documentIndex: number;
  fileId: string;
};

export type ProposedDocumentFailed = {
  type: "EVT-ProposedDocumentFailed";
  aiModelProposalId: string;
  documentIndex: number;
  reason: DocumentFailureReason;
};

export type LoadProposedDocumentError = "ai-model-proposal-document-not-waiting";

/** The link at a place of an accepted proposal that is still waiting to be loaded – none for anything else. */
export function waitingLink(state: AiModelProposalState, index: number) {
  const document = state.state === "accepted" ? state.documents?.[index] : undefined;
  return document?.kind === "link" && document.chosen && document.loading === "waiting" ? document : undefined;
}

export function loadProposedDocument(
  state: AiModelProposalState,
  { index, outcome }: LoadProposedDocumentInput,
  { newId }: DecisionContext<ActorOf<(typeof loadingActors)[number]>>,
): Decision<AiModelProposalState, ProposedDocumentLoaded | ProposedDocumentFailed, LoadProposedDocumentError> {
  const link = waitingLink(state, index);
  if (!link) return { ok: false, error: "ai-model-proposal-document-not-waiting" };
  // The link as it was proposed and chosen: a waiting one has no file and no reason.
  const waiting = {
    kind: link.kind,
    link: link.link,
    title: link.title,
    fileCategory: link.fileCategory,
    chosen: link.chosen,
  } as const;
  const loaded =
    outcome.kind === "loaded"
      ? ({ ...waiting, loading: "loaded", fileId: newId() } as const)
      : ({ ...waiting, loading: "failed", reason: outcome.reason } as const);
  const documents = (state.documents ?? []).map((document, at): ProposedDocument => (at === index ? loaded : document));
  return {
    ok: true,
    state: { ...state, documents },
    events: [
      outcome.kind === "loaded"
        ? {
            type: "EVT-ProposedDocumentLoaded",
            aiModelProposalId: state.id,
            documentIndex: index,
            fileId: (loaded as { fileId: string }).fileId,
          }
        : {
            type: "EVT-ProposedDocumentFailed",
            aiModelProposalId: state.id,
            documentIndex: index,
            reason: outcome.reason,
          },
    ],
  };
}
