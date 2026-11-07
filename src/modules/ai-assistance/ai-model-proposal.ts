import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";

/**
 * AGG-AiModelProposal (ST-123, docs/architecture/data-model.md, data model *AI model proposal*): what an AI makes of
 * the description of a device a technician typed. This story holds the request; the fields, sources and documents
 * of a written one come with the writing (ST-124), the failure with ST-126. It never changes a machine model by itself
 * (ADR 0019) and at most one is being written at a time (HS-37).
 */

/** Who may request an AI model proposal – technicians only; helpers have no access to the machine models. */
type RequestingPerson = ActorOf<"technician">;

/** The five states of the lifecycle (data model *AI model proposal*). */
export const aiModelProposalStates = ["requested", "written", "failed", "accepted", "discarded"] as const;
export type AiModelProposalStateName = (typeof aiModelProposalStates)[number];

/** AGG-AiModelProposal – current state. */
export type AiModelProposalState = {
  id: string;
  /** What the technician typed, as typed (trimmed) – never changes (invariant). */
  description: string;
  requestedBy: TeamMemberId;
  requestedAt: Date;
  /** The chat model it was requested with – never changes. */
  chatModel: string;
  state: AiModelProposalStateName;
};

/** What CMD-RequestAiModelProposal reads from the outside before it decides. */
export type RequestAiModelProposalFacts = {
  /** The chat model a request is made with – none while AI is off (AGG-AiSettings). */
  chatModel: string | undefined;
  /** Another AI model proposal is still being written (HS-37) – one at a time, over all of them. */
  beingWritten: boolean;
};

export type RequestAiModelProposalInput = { description: string };

export type AiModelProposalRequested = {
  type: "EVT-AiModelProposalRequested";
  aiModelProposalId: string;
  requestedBy: TeamMemberId;
  chatModel: string;
};

export type RequestAiModelProposalError =
  "ai-model-proposal-ai-off" | "ai-model-proposal-description-required" | "ai-model-proposal-being-written";

/**
 * Why CMD-RequestAiModelProposal refuses a request with this description now – the decision applies it, and the page
 * that offers „Mit KI erstellen“ asks the same rule for the state of the world (G11, G37). The description is a matter
 * of the form, so the page passes none and gets only the reasons that hold whatever is typed.
 */
export function requestRefusal(
  facts: RequestAiModelProposalFacts,
  description?: string,
): RequestAiModelProposalError | undefined {
  if (!facts.chatModel) return "ai-model-proposal-ai-off";
  if (description !== undefined && !description.trim()) return "ai-model-proposal-description-required";
  if (facts.beingWritten) return "ai-model-proposal-being-written";
  return undefined;
}

/**
 * CMD-RequestAiModelProposal (AGG-AiModelProposal, ST-123): a technician describes a device while AI is on, the
 * description is not blank and no AI model proposal is being written (HS-37). The request is all it stores; the
 * writing starts after the response (POL-RequestedAiModelProposalIsWritten, ADR 0015). The typed description is free
 * text and stays out of the journal; the event names who asked and the chat model.
 */
export function requestAiModelProposal(
  facts: RequestAiModelProposalFacts,
  input: RequestAiModelProposalInput,
  { actor, clock, newId }: DecisionContext<RequestingPerson>,
): Decision<AiModelProposalState, AiModelProposalRequested, RequestAiModelProposalError> {
  const refusal = requestRefusal(facts, input.description);
  if (refusal) return { ok: false, error: refusal };
  const state: AiModelProposalState = {
    id: newId(),
    description: input.description.trim(),
    requestedBy: actor.teamMemberId,
    requestedAt: clock.now(),
    // `requestRefusal` lets no request through without one.
    chatModel: facts.chatModel!,
    state: "requested",
  };
  return {
    ok: true,
    state,
    events: [
      {
        type: "EVT-AiModelProposalRequested",
        aiModelProposalId: state.id,
        requestedBy: state.requestedBy,
        chatModel: state.chatModel,
      },
    ],
  };
}
