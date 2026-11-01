import { and, desc, eq } from "drizzle-orm";
import { aggregateStore, type Database } from "@/platform/command";
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

export const aiAssessments = aggregateStore({
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

/** The newest AI assessment of the defect, being written or ended – what the defect page shows (RM-DefectAiAssessments). */
export async function newestAiAssessmentOf(db: Database, defectId: string): Promise<AiAssessmentState | undefined> {
  const [row] = await db
    .select()
    .from(aiAssessment)
    .where(eq(aiAssessment.defectId, defectId))
    .orderBy(desc(aiAssessment.requestedAt), desc(aiAssessment.id))
    .limit(1);
  return row && toState(row);
}
