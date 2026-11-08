import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import type { AiModelProposalState, ProposedDocument } from "./ai-model-proposal";

/**
 * CMD-RetryProposedDocument (AGG-AiModelProposal, ST-130, ADR 0019): „Nochmal versuchen“ beside a failed link of a saved
 * proposal. Only a chosen link that failed; it is waiting again and the background work (POL-AcceptedProposalDocumentsAreLoaded,
 * started because this event makes work) loads it as in ST-129. A link that failed for a reason that cannot change – too
 * large, no PDF or text – may be retried as well: the same reason follows. Works while AI is off: nothing here reads a setting.
 * It is a change at the version the technician saw (HS-16), like every command of a person on an existing aggregate.
 */

/** Who may retry – every technician. */
export const retryingActors = ["technician"] as const;
type RetryingPerson = ActorOf<(typeof retryingActors)[number]>;

export type RetryProposedDocumentInput = {
  aiModelProposalId: string;
  /** The link's place in the proposal's documents (they never change once written). */
  index: number;
  /** The version the technician saw (HS-16). */
  version: number;
};

/** Only the fact reaches the journal: which link, by its place – no title, no address. */
export type ProposedDocumentLoadingRetried = {
  type: "EVT-ProposedDocumentLoadingRetried";
  aiModelProposalId: string;
  documentIndex: number;
};

export type RetryProposedDocumentError = "ai-model-proposal-document-not-failed";

/** The chosen link at a place of an accepted proposal that failed – none for anything else (rule). */
function failedLink(state: AiModelProposalState, index: number) {
  const document = state.state === "accepted" ? state.documents?.[index] : undefined;
  return document?.kind === "link" && document.chosen && document.loading === "failed" ? document : undefined;
}

export function retryProposedDocument(
  state: AiModelProposalState,
  { index }: RetryProposedDocumentInput,
  _context: DecisionContext<RetryingPerson>,
): Decision<AiModelProposalState, ProposedDocumentLoadingRetried, RetryProposedDocumentError> {
  const link = failedLink(state, index);
  if (!link) return { ok: false, error: "ai-model-proposal-document-not-failed" };
  // Waiting again: the link as it was chosen, without the reason it failed with.
  const { reason: _reason, fileId: _fileId, ...kept } = link;
  const waiting: ProposedDocument = { ...kept, loading: "waiting" };
  const documents = (state.documents ?? []).map((document, at) => (at === index ? waiting : document));
  return {
    ok: true,
    state: { ...state, documents },
    events: [{ type: "EVT-ProposedDocumentLoadingRetried", aiModelProposalId: state.id, documentIndex: index }],
  };
}
