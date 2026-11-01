import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { aggregateStore, Rejected, type AggregateStore, type Database } from "@/platform/command";
import type { AiAssessmentState } from "./ai-assessment";
import { aiAssessment } from "./schema";

/**
 * How AGG-AiAssessment is stored (ST-107): one row per request, versioned (HS-16). The partial unique index on
 * `defect_id` where `state = 'requested'` is the store's guarantee of HS-31 – a second request while one is being
 * written cannot be stored, whatever a decision checked before.
 */
function toState(row: typeof aiAssessment.$inferSelect): AiAssessmentState {
  return {
    id: row.id,
    defectId: row.defectId,
    ...(row.note !== null && { note: row.note }),
    photos: row.photos,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt,
    chatModel: row.chatModel,
    state: row.state,
    ...(row.summary !== null && { summary: row.summary }),
    ...(row.probableCauses !== null && { probableCauses: row.probableCauses }),
    ...(row.whatToCheckFirst !== null && { whatToCheckFirst: row.whatToCheckFirst }),
    ...(row.references !== null && { references: row.references }),
    ...(row.filesSearched !== null && { filesSearched: row.filesSearched }),
    ...(row.embeddingModel !== null && { embeddingModel: row.embeddingModel }),
    ...(row.cost !== null && { cost: row.cost }),
    ...(row.changedAt !== null && { changedAt: row.changedAt }),
    ...(row.failureReason !== null && { failureReason: row.failureReason }),
  };
}

const store = aggregateStore({
  type: "AGG-AiAssessment",
  table: aiAssessment,
  toState,
  toRow: (state: AiAssessmentState) => ({
    id: state.id,
    defectId: state.defectId,
    note: state.note ?? null,
    photos: state.photos,
    requestedBy: state.requestedBy,
    requestedAt: state.requestedAt,
    chatModel: state.chatModel,
    state: state.state,
    summary: state.summary ?? null,
    probableCauses: state.probableCauses ?? null,
    whatToCheckFirst: state.whatToCheckFirst ?? null,
    references: state.references ?? null,
    filesSearched: state.filesSearched ?? null,
    embeddingModel: state.embeddingModel ?? null,
    cost: state.cost ?? null,
    changedAt: state.changedAt ?? null,
    failureReason: state.failureReason ?? null,
  }),
});

/**
 * The store of AGG-AiAssessment – the set-based rule HS-31 is guaranteed here, like the museum number (HS-17): two
 * requests of one defect at the same moment both pass the sequential facts check, and the partial unique index rejects
 * the loser. That violation is the domain's *being written* rejection, never a raw 500. The ordinary sequential case is
 * caught by the command's facts; this is the final guarantee.
 */
export const aiAssessments: AggregateStore<AiAssessmentState> = {
  ...store,
  async insert(tx, state) {
    try {
      await store.insert(tx, state);
    } catch (error) {
      if (isBeingWrittenViolation(error)) throw new Rejected("ai-assessment-being-written");
      throw error;
    }
  },
};

/** A unique violation of the partial index that keeps at most one requested AI assessment per defect (HS-31). */
function isBeingWrittenViolation(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const { code, constraint } = (cause ?? {}) as { code?: string; constraint?: string };
  return code === "23505" && constraint === "ai_assessment_being_written_idx";
}

/** One AI assessment by its ID – undefined for an unknown one (a stale hold). */
export async function aiAssessmentById(db: Database, id: string): Promise<AiAssessmentState | undefined> {
  return (await aiAssessments.load(db, id))?.state;
}

/** Whether an AI assessment of the defect is still being written (HS-31) – the request's rule reads it as a fact. */
export async function aiAssessmentBeingWritten(db: Database, defectId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: aiAssessment.id })
    .from(aiAssessment)
    .where(and(eq(aiAssessment.defectId, defectId), eq(aiAssessment.state, "requested")))
    .limit(1);
  return !!row;
}

/** The AI assessments of the defect that are still being written – what a run takes (the oldest first). */
export async function requestedAiAssessmentIds(db: Database): Promise<string[]> {
  const rows = await db
    .select({ id: aiAssessment.id })
    .from(aiAssessment)
    .where(eq(aiAssessment.state, "requested"))
    .orderBy(aiAssessment.requestedAt, aiAssessment.id);
  return rows.map((row) => row.id);
}

/**
 * The AI assessments of the defect, the newest first – the defect page shows the newest open and the earlier ones
 * folded (ST-111); „Erneut versuchen“ reads the failed one from it (ST-108).
 */
export async function aiAssessmentsOfDefect(db: Database, defectId: string): Promise<AiAssessmentState[]> {
  const rows = await db
    .select()
    .from(aiAssessment)
    .where(eq(aiAssessment.defectId, defectId))
    .orderBy(desc(aiAssessment.requestedAt), desc(aiAssessment.id));
  return rows.map(toState);
}

/**
 * The written and failed AI assessments of these defects, each defect's newest first – what the repair history shows
 * under its defects (RM-MachineRecord, ST-111). One being written is not history yet.
 */
export async function endedAiAssessmentsOfDefects(
  db: Database,
  defectIds: string[],
): Promise<Map<string, AiAssessmentState[]>> {
  const byDefect = new Map<string, AiAssessmentState[]>();
  if (defectIds.length === 0) return byDefect;
  const rows = await db
    .select()
    .from(aiAssessment)
    .where(and(inArray(aiAssessment.defectId, defectIds), ne(aiAssessment.state, "requested")))
    .orderBy(desc(aiAssessment.requestedAt), desc(aiAssessment.id));
  for (const row of rows) byDefect.set(row.defectId, [...(byDefect.get(row.defectId) ?? []), toState(row)]);
  return byDefect;
}
