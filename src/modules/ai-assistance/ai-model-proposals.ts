import { desc, eq, inArray } from "drizzle-orm";
import { aggregateStore, Rejected, type AggregateStore, type Database } from "@/platform/command";
import type { AiModelProposalState } from "./ai-model-proposal";
import { aiModelProposal } from "./schema";

/**
 * How AGG-AiModelProposal is stored (ST-123): one row per request, versioned (HS-16). The partial unique index on a
 * constant where `state = 'requested'` is the store's guarantee of HS-37 – a second request while one is being written
 * cannot be stored, whatever a decision checked before.
 */
function toState(row: typeof aiModelProposal.$inferSelect): AiModelProposalState {
  return {
    id: row.id,
    description: row.description,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt,
    chatModel: row.chatModel,
    state: row.state,
  };
}

const store = aggregateStore({
  type: "AGG-AiModelProposal",
  table: aiModelProposal,
  toState,
  toRow: (state: AiModelProposalState) => ({
    id: state.id,
    description: state.description,
    requestedBy: state.requestedBy,
    requestedAt: state.requestedAt,
    chatModel: state.chatModel,
    state: state.state,
  }),
});

/**
 * The store of AGG-AiModelProposal – the set-based rule HS-37 is guaranteed here, like HS-31: two requests at the same
 * moment both pass the sequential facts check, and the partial unique index rejects the loser. That violation is the
 * domain's *being written* rejection, never a raw 500.
 */
export const aiModelProposals: AggregateStore<AiModelProposalState> = {
  ...store,
  async insert(tx, state) {
    try {
      await store.insert(tx, state);
    } catch (error) {
      if (isBeingWrittenViolation(error)) throw new Rejected("ai-model-proposal-being-written");
      throw error;
    }
  },
};

/** A unique violation of the partial index that keeps at most one requested AI model proposal (HS-37). */
function isBeingWrittenViolation(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const { code, constraint } = (cause ?? {}) as { code?: string; constraint?: string };
  return code === "23505" && constraint === "ai_model_proposal_being_written_idx";
}

/** Whether an AI model proposal is still being written (HS-37) – the request's rule reads it as a fact. */
export async function aiModelProposalBeingWritten(db: Database): Promise<boolean> {
  const [row] = await db
    .select({ id: aiModelProposal.id })
    .from(aiModelProposal)
    .where(eq(aiModelProposal.state, "requested"))
    .limit(1);
  return !!row;
}

/** One AI model proposal by its ID – undefined for an unknown one. */
export async function aiModelProposalById(db: Database, id: string): Promise<AiModelProposalState | undefined> {
  return (await aiModelProposals.load(db, id))?.state;
}

type OpenProposal = { id: string; description: string; state: "requested" | "written" | "failed" };

/**
 * The AI model proposals that are still open (RM-AiModelProposals): being written, written or failed – the newest first.
 * An accepted one with a link still waiting or failed joins them with the saving (ST-128, ST-130).
 */
export async function openAiModelProposalStates(db: Database): Promise<OpenProposal[]> {
  const rows = await db
    .select()
    .from(aiModelProposal)
    .where(inArray(aiModelProposal.state, ["requested", "written", "failed"]))
    .orderBy(desc(aiModelProposal.requestedAt), desc(aiModelProposal.id));
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    // The query selects these three only.
    state: row.state as OpenProposal["state"],
  }));
}
