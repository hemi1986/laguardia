import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import type { DefectState } from "@/modules/repair";

/**
 * AGG-AiAssessment (ST-107, docs/architecture/data-model.md, data model *AI assessment*): a request for an AI's first
 * view of an open defect, and what came of it. It refers to its defect by ID and never changes the defect; a defect
 * may have any number of them, but at most one is being written at a time (HS-31). The note and photos belong to the
 * AI assessment, not to the defect, and never change.
 */

/** At most this many photos with a request – the work log entry's limit (ST-032, "photos as on a work log entry"). */
export const MAX_AI_ASSESSMENT_PHOTOS = 5;

/** Who may request an AI assessment – every team member; the helper's rule is the decision's. */
type RequestingPerson = ActorOf<"helper" | "technician">;

/** Why an AI assessment failed (data model *AssessmentFailureReason*, EVT-AiAssessmentFailed). */
export const assessmentFailureReasons = [
  "key-invalid",
  "credit-used-up",
  "model-not-available",
  "timed-out",
  "openrouter-not-reachable",
  "ai-off",
  "answer-unusable",
  "broken-off",
] as const;
export type AssessmentFailureReason = (typeof assessmentFailureReasons)[number];

/** A place in a file an AI assessment relied on – the file and, for a PDF, the page (CONTEXT.md: Reference). */
export type AiAssessmentReference = { fileId: string; page?: number };

/** AGG-AiAssessment – current state. */
export type AiAssessmentState = {
  id: string;
  /** Its one defect – never changes (invariant). */
  defectId: string;
  /** The team member's optional addition to the request. */
  note?: string;
  /** The stored names of the request's photos – at most 5, never changed. */
  photos: string[];
  requestedBy: TeamMemberId;
  requestedAt: Date;
  /** The chat model it was requested with – never changes. */
  chatModel: string;
  state: "requested" | "written" | "failed";
  /** Written only: what the AI found, in German. */
  summary?: string;
  probableCauses?: string[];
  whatToCheckFirst?: string[];
  /** Written only – may be empty. */
  references?: AiAssessmentReference[];
  /** Written only: the files whose AI index was searched. */
  filesSearched?: string[];
  embeddingModel?: string;
  cost?: number;
  /** Written or failed at. */
  changedAt?: Date;
  /** Failed only. */
  failureReason?: AssessmentFailureReason;
};

/** What CMD-RequestAiAssessment reads from the outside before it decides. */
export type RequestAiAssessmentFacts = {
  /** The chat model a request is made with – none while AI is off (AGG-AiSettings). */
  chatModel: string | undefined;
  /** The defect as Repair knows it now – none for an unknown defect. */
  defect: { state: DefectState; suitableForHelpers: boolean } | undefined;
  /** Another AI assessment of the defect is still being written (HS-31). */
  beingWritten: boolean;
};

export type RequestAiAssessmentInput = {
  defectId: string;
  note: string;
  /** The stored names of the photos sent with it – stored before the command runs (ADR 0009). */
  photos?: readonly string[];
};

export type AiAssessmentRequested = {
  type: "EVT-AiAssessmentRequested";
  aiAssessmentId: string;
  defectId: string;
  requestedBy: TeamMemberId;
  chatModel: string;
};

export type RequestAiAssessmentError =
  | "ai-assessment-ai-off"
  | "ai-assessment-defect-not-open"
  | "ai-assessment-not-allowed-for-helpers"
  | "ai-assessment-being-written"
  | "ai-assessment-too-many-photos";

/**
 * Why CMD-RequestAiAssessment refuses this person now – the decision applies it, and RM-DefectAiAssessments asks it for
 * the team member looking at the page (G11), where nobody may be logged in. The number of photos is a matter of the form.
 */
export function requestRefusal(
  facts: RequestAiAssessmentFacts,
  person: Pick<RequestingPerson, "role"> | undefined,
): Exclude<RequestAiAssessmentError, "ai-assessment-too-many-photos"> | undefined {
  if (!facts.chatModel) return "ai-assessment-ai-off";
  if (!facts.defect || facts.defect.state !== "open") return "ai-assessment-defect-not-open";
  if (!person || (person.role === "helper" && !facts.defect.suitableForHelpers))
    return "ai-assessment-not-allowed-for-helpers";
  if (facts.beingWritten) return "ai-assessment-being-written";
  return undefined;
}

/**
 * CMD-RequestAiAssessment (AGG-AiAssessment, ST-107): a team member asks for an AI assessment of an open defect –
 * technicians for any, helpers only for one suitable for helpers – while AI is on and none of the defect is being
 * written (HS-31). The request is all it stores; the writing starts after the response (POL-RequestedAiAssessmentIsWritten,
 * ADR 0015).
 */
export function requestAiAssessment(
  facts: RequestAiAssessmentFacts,
  input: RequestAiAssessmentInput,
  { actor, clock, newId }: DecisionContext<RequestingPerson>,
): Decision<AiAssessmentState, AiAssessmentRequested, RequestAiAssessmentError> {
  const refusal = requestRefusal(facts, actor);
  if (refusal) return { ok: false, error: refusal };
  const photos = [...(input.photos ?? [])];
  if (photos.length > MAX_AI_ASSESSMENT_PHOTOS) return { ok: false, error: "ai-assessment-too-many-photos" };
  const note = input.note.trim();
  const state: AiAssessmentState = {
    id: newId(),
    defectId: input.defectId,
    ...(note && { note }),
    photos,
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
        type: "EVT-AiAssessmentRequested",
        aiAssessmentId: state.id,
        defectId: state.defectId,
        requestedBy: state.requestedBy,
        chatModel: state.chatModel,
      },
    ],
  };
}

/** What CMD-WriteAiAssessment applies – the answer of the chat model, already checked against the domain's rules. */
export type WriteAiAssessmentInput = {
  summary: string;
  probableCauses: string[];
  whatToCheckFirst: string[];
  references: AiAssessmentReference[];
  /**
   * The files attached to the defect's machine or its machine model, read once when the writing began (ST-120) – what
   * references are checked against. Only the system runs the command, so the list passes through its input instead of
   * being read again when the result is stored.
   */
  filesAttached: readonly string[];
  filesSearched: string[];
  embeddingModel: string;
  cost: number;
};

export type AiAssessmentWritten = {
  type: "EVT-AiAssessmentWritten";
  aiAssessmentId: string;
  defectId: string;
  chatModel: string;
  embeddingModel: string;
  /** The files and pages the AI relied on, and the files whose index was searched – IDs only, never text. */
  references: AiAssessmentReference[];
  filesSearched: string[];
  cost: number;
};

/**
 * CMD-WriteAiAssessment (ST-107): the AI assessment still requested takes the chat model's answer. A late result – the
 * assessment was failed as broken off meanwhile – records nothing (rule, version check; HS-33). The written text is
 * free text and stays out of the journal; the event names the models and the cost. The command enforces the aggregate's
 * invariant itself: a reference to a file that was not attached to the defect's machine or its machine model when the
 * writing began is dropped – a file detached meanwhile keeps its reference (ST-120) – and every reference is kept once.
 */
export function writeAiAssessment(
  state: AiAssessmentState,
  input: WriteAiAssessmentInput,
  { clock }: DecisionContext,
): Decision<AiAssessmentState, AiAssessmentWritten, "not-requested"> {
  if (state.state !== "requested") return { ok: false, error: "not-requested" };
  const allowed = new Set(input.filesAttached);
  const references = input.references
    .filter((reference) => allowed.has(reference.fileId))
    .filter(
      (reference, index, all) =>
        all.findIndex((each) => each.fileId === reference.fileId && each.page === reference.page) === index,
    );
  const written: AiAssessmentState = {
    ...state,
    state: "written",
    summary: input.summary,
    probableCauses: input.probableCauses,
    whatToCheckFirst: input.whatToCheckFirst,
    references,
    filesSearched: input.filesSearched,
    embeddingModel: input.embeddingModel,
    cost: input.cost,
    changedAt: clock.now(),
  };
  return {
    ok: true,
    state: written,
    events: [
      {
        type: "EVT-AiAssessmentWritten",
        aiAssessmentId: state.id,
        defectId: state.defectId,
        chatModel: state.chatModel,
        embeddingModel: input.embeddingModel,
        references,
        filesSearched: input.filesSearched,
        cost: input.cost,
      },
    ],
  };
}

export type AiAssessmentFailed = {
  type: "EVT-AiAssessmentFailed";
  aiAssessmentId: string;
  defectId: string;
  reason: AssessmentFailureReason;
};

/** A failed AI assessment – still requested only, like writing it (a late result records nothing). */
export function failAiAssessment(
  state: AiAssessmentState,
  reason: AssessmentFailureReason,
  { clock }: DecisionContext,
): Decision<AiAssessmentState, AiAssessmentFailed, "not-requested"> {
  if (state.state !== "requested") return { ok: false, error: "not-requested" };
  return {
    ok: true,
    state: { ...state, state: "failed", failureReason: reason, changedAt: clock.now() },
    events: [{ type: "EVT-AiAssessmentFailed", aiAssessmentId: state.id, defectId: state.defectId, reason }],
  };
}
