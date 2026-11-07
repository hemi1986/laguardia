import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import type { AiModelProposalState } from "./ai-model-proposal";

/**
 * CMD-DiscardAiModelProposal (AGG-AiModelProposal, ST-127): „Verwerfen“ on a written or failed proposal's page. Nothing
 * is saved and no file is touched – the proposal only ends. A proposal still being written, already saved or already
 * discarded is rejected (rule); the rejection of a saved one comes first, so the technician is told it was saved. Works
 * while AI is off: discarding reads no setting.
 */

/** Who may discard – every technician (the two of them share the list). */
export const discardingActors = ["technician"] as const;
type DiscardingPerson = ActorOf<(typeof discardingActors)[number]>;

export type DiscardAiModelProposalInput = {
  aiModelProposalId: string;
  /** The version the technician saw (HS-16). */
  version: number;
};

/** Nothing but the fact reaches the journal – the typed description is free text and stays out. */
export type AiModelProposalDiscarded = {
  type: "EVT-AiModelProposalDiscarded";
  aiModelProposalId: string;
};

export type DiscardAiModelProposalError = "ai-model-proposal-already-accepted" | "ai-model-proposal-not-discardable";

/** Whether a proposal in this state can be discarded – only a written or failed one (rule). */
function discardable(state: AiModelProposalState["state"]): boolean {
  return state === "written" || state === "failed";
}

export function discardAiModelProposal(
  state: AiModelProposalState,
  input: DiscardAiModelProposalInput,
  _context: DecisionContext<DiscardingPerson>,
): Decision<AiModelProposalState, AiModelProposalDiscarded, DiscardAiModelProposalError> {
  if (state.state === "accepted") return { ok: false, error: "ai-model-proposal-already-accepted" };
  if (!discardable(state.state)) return { ok: false, error: "ai-model-proposal-not-discardable" };
  return {
    ok: true,
    state: { ...state, state: "discarded" },
    events: [{ type: "EVT-AiModelProposalDiscarded", aiModelProposalId: state.id }],
  };
}
