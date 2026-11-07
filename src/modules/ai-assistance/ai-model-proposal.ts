import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import { machineCategories, technologiesOf, type MachineCategory, type Technology } from "@/modules/collection";
import { assessmentFailureReasons } from "./ai-assessment";

/**
 * AGG-AiModelProposal (ST-123, docs/architecture/data-model.md, data model *AI model proposal*): what an AI makes of
 * the description of a device a technician typed. ST-123 holds the request, ST-124 the writing (fields, sources, existing
 * files ST-125 and links of a written one), the failure with ST-126. It never changes a machine model by itself
 * (ADR 0019) and at most one is being written at a time (HS-37).
 */

/** Who may request an AI model proposal – technicians only; helpers have no access to the machine models. */
type RequestingPerson = ActorOf<"technician">;

/** The five states of the lifecycle (data model *AI model proposal*). */
export const aiModelProposalStates = ["requested", "written", "failed", "accepted", "discarded"] as const;
export type AiModelProposalStateName = (typeof aiModelProposalStates)[number];

/**
 * Why an AI model proposal failed (data model *ProposalFailureReason*, EVT-AiModelProposalFailed): the reasons of an AI
 * assessment – OpenRouter's failures, AI off, an unusable answer, broken off – and *device not recognised*.
 */
export const aiModelProposalFailureReasons = [...assessmentFailureReasons, "device-not-recognised"] as const;
export type AiModelProposalFailureReason = (typeof aiModelProposalFailureReasons)[number];

/** The file categories a proposed document may have – a photo is no document of a proposal (no images, ST-124). */
export const proposedFileCategories = ["manual", "schematic", "other"] as const;
export type ProposedFileCategory = (typeof proposedFileCategories)[number];

/** At most this many documents in a written AI model proposal (invariant). */
export const MAX_PROPOSED_DOCUMENTS = 10;

/** Why a chosen link could not be loaded (ST-129, `DocumentFailureReason`) – each has its UI word in the message catalog. */
export const documentFailureReasons = [
  "not-reachable",
  "too-large",
  "not-pdf-or-text",
  "address-not-allowed",
  "broken-off",
] as const;
export type DocumentFailureReason = (typeof documentFailureReasons)[number];

/** A document the AI found on the web: a link (https) with a title and one file category. */
export type ProposedLink = {
  kind: "link";
  link: string;
  title: string;
  fileCategory: ProposedFileCategory;
  /** Accepted only (ST-128): the technician chose it – its title and file category are then as chosen. */
  chosen?: true;
  /** A chosen link only: waiting to be loaded (ST-128), loaded as a file or failed with one reason (ST-129). */
  loading?: "waiting" | "loaded" | "failed";
  /** Loaded only (ST-129): the file this link became. */
  fileId?: string;
  /** Failed only (ST-129). */
  reason?: DocumentFailureReason;
};
/** A file the museum already has, found in the AI index (ST-125): by ID, with the title and file category it had then. */
export type ProposedFile = {
  kind: "file";
  fileId: string;
  title: string;
  fileCategory: ProposedFileCategory;
  /** Accepted only (ST-128): the technician chose it – it was attached to the machine model. */
  chosen?: true;
};
export type ProposedDocument = ProposedFile | ProposedLink;

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
  /** Written only – each field empty (absent) or valid (invariant). */
  title?: string;
  manufacturer?: string;
  year?: number;
  machineCategory?: MachineCategory;
  technology?: Technology;
  /** Written only – the links the fields rest on (https). */
  sources?: string[];
  /** Written only – at most {@link MAX_PROPOSED_DOCUMENTS}. */
  documents?: ProposedDocument[];
  embeddingModel?: string;
  cost?: number;
  /** Accepted only (ST-128): the machine model this proposal created – never changes. */
  machineModelId?: string;
  /** Written or failed at (accepted, ST-128: the same instant stays). */
  changedAt?: Date;
  /** Failed only (ST-126). */
  failureReason?: AiModelProposalFailureReason;
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

/**
 * What the chat model named, as the answer's parser read it – untrusted, nothing of it checked yet. CMD-WriteAiModelProposal
 * owns the invariants: what is not valid is left empty, not repaired (rule).
 */
export type AiModelProposalAnswer = {
  title?: string;
  manufacturer?: string;
  /** As named – "1986", "ca. 1986" – only a plain four-digit number is a year. */
  year?: string;
  machineCategory?: string;
  technology?: string;
  sources: string[];
  documents: { link: string; title: string; fileCategory: string }[];
};

/** A file the AI index found for the completed fields (ST-125) – read from Collection, so its title and category are trusted. */
export type FoundFile = { fileId: string; title: string; fileCategory: string };

export type WriteAiModelProposalInput = {
  answer: AiModelProposalAnswer;
  /** The files the AI index found, best first (ST-125) – offered before the links. */
  existingFiles?: FoundFile[];
  /** The embedding model the AI index was searched with (ST-125) – none while no search was made. */
  embeddingModel?: string;
  /** What OpenRouter charged for the whole writing, in US dollars. */
  cost: number;
};

export type AiModelProposalWritten = {
  type: "EVT-AiModelProposalWritten";
  aiModelProposalId: string;
  chatModel: string;
  embeddingModel?: string;
  cost: number;
};

/** A link the proposal may keep: an `https` address and nothing else (rule, ADR 0019 decision 3). */
export function httpsLink(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Addresses that end in an image or video file – a proposal holds text documents only. */
const PICTURE_OR_FILM = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|svg|heic|mp4|m4v|mov|avi|mkv|webm|mpe?g|wmv|flv)$/i;
const isPictureOrFilm = (address: string) => PICTURE_OR_FILM.test(new URL(address).pathname);

/** A year is exactly four digits (as on a machine model). */
function validYear(value: string | undefined): number | undefined {
  return value !== undefined && /^\d{4}$/.test(value.trim()) ? Number(value.trim()) : undefined;
}

/**
 * CMD-WriteAiModelProposal (AGG-AiModelProposal, ST-124): run by POL-RequestedAiModelProposalIsWritten as the system.
 * Only a proposal still requested is written – a late result after it was failed as broken off records nothing
 * (version check, rule). Every field is empty or valid: a machine category of none of the three, a technology that
 * does not fit it and a year that is not four digits are left empty, not repaired; at most 10 documents, only https
 * links, no duplicates. The text of the fields stays out of the journal; it says that it was written and what it cost.
 */
export function writeAiModelProposal(
  state: AiModelProposalState,
  { answer, existingFiles = [], embeddingModel, cost }: WriteAiModelProposalInput,
  { clock }: DecisionContext,
): Decision<AiModelProposalState, AiModelProposalWritten | AiModelProposalFailed, "not-requested"> {
  if (state.state !== "requested") return { ok: false, error: "not-requested" };
  // No usable machine in the answer fails it (rule): nothing to propose, and nothing to keep.
  if (!machineNamed(answer)) return failAiModelProposal(state, "device-not-recognised", { clock });
  const machineCategory = machineCategories.find((category) => category === answer.machineCategory);
  const technology = machineCategory
    ? technologiesOf(machineCategory).find((candidate) => candidate === answer.technology)
    : undefined;
  const year = validYear(answer.year);
  const title = answer.title?.trim();
  const manufacturer = answer.manufacturer?.trim();
  const sources = unique(answer.sources.flatMap((source) => httpsLink(source) ?? []));
  // Existing files come first and count within the 10 (rule); a photo is no document of a proposal.
  const files = uniqueBy(
    existingFiles.flatMap(({ fileId, title: fileTitle, fileCategory }): ProposedFile[] => {
      const category = proposedFileCategories.find((candidate) => candidate === fileCategory);
      return category ? [{ kind: "file", fileId, title: fileTitle, fileCategory: category }] : [];
    }),
    (document) => document.fileId,
  );
  const links = uniqueBy(
    answer.documents.flatMap(({ link, title: documentTitle, fileCategory }): ProposedLink[] => {
      const address = httpsLink(link);
      const named = documentTitle.trim();
      // No images, no video (rule): a document the AI calls a photo, or whose address is a picture or a film, is left out.
      if (!address || !named || fileCategory === "photo" || isPictureOrFilm(address)) return [];
      const category = proposedFileCategories.find((candidate) => candidate === fileCategory);
      return [{ kind: "link", link: address, title: named, fileCategory: category ?? "other" }];
    }),
    (document) => document.link,
  );
  const documents: ProposedDocument[] = [...files, ...links].slice(0, MAX_PROPOSED_DOCUMENTS);
  const written: AiModelProposalState = {
    ...state,
    state: "written",
    ...(title && { title }),
    ...(manufacturer && { manufacturer }),
    ...(year !== undefined && { year }),
    ...(machineCategory && { machineCategory }),
    ...(technology && { technology }),
    sources,
    documents,
    ...(embeddingModel !== undefined && { embeddingModel }),
    cost,
    changedAt: clock.now(),
  };
  return {
    ok: true,
    state: written,
    events: [
      {
        type: "EVT-AiModelProposalWritten",
        aiModelProposalId: state.id,
        chatModel: state.chatModel,
        ...(embeddingModel !== undefined && { embeddingModel }),
        cost,
      },
    ],
  };
}

/**
 * Whether the answer names a machine (rule, ST-126): a title or a manufacturer. Fields without either – a category or a
 * year alone – do not make a device; a blank title with a manufacturer is still written (ST-124).
 */
export function machineNamed(answer: AiModelProposalAnswer): boolean {
  return !!(answer.title?.trim() || answer.manufacturer?.trim());
}

export type AiModelProposalFailed = {
  type: "EVT-AiModelProposalFailed";
  aiModelProposalId: string;
  reason: AiModelProposalFailureReason;
};

/**
 * The failing half of CMD-WriteAiModelProposal (ST-126): a proposal still requested is recorded failed with one reason –
 * a late result after it was failed as broken off records nothing (version check, rule). A failed proposal is never
 * written again automatically; „Nochmal versuchen“ requests a new one (HS-42). The typed description stays out of the
 * journal.
 */
export function failAiModelProposal(
  state: AiModelProposalState,
  reason: AiModelProposalFailureReason,
  { clock }: Pick<DecisionContext, "clock">,
): Decision<AiModelProposalState, AiModelProposalFailed, "not-requested"> {
  if (state.state !== "requested") return { ok: false, error: "not-requested" };
  return {
    ok: true,
    state: { ...state, state: "failed", failureReason: reason, changedAt: clock.now() },
    events: [{ type: "EVT-AiModelProposalFailed", aiModelProposalId: state.id, reason }],
  };
}

const unique = <T>(values: T[]): T[] => [...new Set(values)];

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => !seen.has(key(value)) && !!seen.add(key(value)));
}
