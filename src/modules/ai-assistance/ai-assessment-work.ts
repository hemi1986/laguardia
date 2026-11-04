import type { Clock } from "@/platform/clock";
import { executeCommand, type Database } from "@/platform/command";
import { fileForIndexing, filesOfMachineAndModelForAi, machineModelOfMachineForAi } from "@/modules/collection";
import { defectForAiAssessment } from "@/modules/repair";
import type { AssessmentFailureReason } from "./ai-assessment";
import { aiAssessmentById, requestedAiAssessmentIds } from "./ai-assessments";
import {
  aiAssessmentChatRequest,
  failureOfEmbedding,
  outcomeOfChat,
  searchTextOf,
  whatToRead,
} from "./ai-assessment-writing";
import { aiState } from "./ai-settings";
import { renderPdfPages } from "./file-indexing";
import { searchAiIndex, searchedFiles, type AiIndexHit } from "./ai-index-search";
import { aiWorkLeftUnfinished, type AiWorkContext, type AiWorkKind, type HeldPiece } from "./ai-work";
import { failAiAssessmentCommand, writeAiAssessmentCommand } from "./write-ai-assessment-command";
import type { ChatImage } from "./ai-seam";
import type { OpenRouterSession } from "./open-router-session";

/**
 * Writing an AI assessment as a kind of the background work (ST-107, ADR 0015, POL-RequestedAiAssessmentIsWritten).
 * A run takes one whole AI assessment: what is known about the defect is read outside any transaction from Repair and
 * Collection, the AI index is searched with the text and with each photo of the request, the chat model answers, and
 * only the storage of the answer is one short transaction that ends the hold. Turning AI off stops the writing at the
 * next request and sends nothing more (CMD-WriteAiAssessment rule, the piece's OpenRouter session).
 */
const AI_ASSESSMENT_KIND = "ai-assessment";

/** Whether this AI assessment was left unfinished: its hold ran out without a result (HS-33). */
export function aiAssessmentLeftUnfinished(db: Database, clock: Clock, aiAssessmentId: string): Promise<boolean> {
  return aiWorkLeftUnfinished(db, clock, AI_ASSESSMENT_KIND, [aiAssessmentId]);
}

export const aiAssessmentWork: AiWorkKind = {
  kind: AI_ASSESSMENT_KIND,

  /** The AI assessments still requested – a person is waiting, so a run takes them before waiting files (ADR 0015). */
  waiting(db) {
    return requestedAiAssessmentIds(db);
  },

  /** Asked again once the piece is held: written, failed or recorded broken off meanwhile is no longer waited for. */
  async isWaiting(tx, id) {
    return (await aiAssessmentById(tx, id))?.state === "requested";
  },

  async work(id, piece, context) {
    // AI turned off before it started: nothing is sent, and the request is failed as *AI off* (rule).
    if (!(await aiState(context.db, context.ai)).on) return fail(id, "ai-off", piece, context);
    const assessment = await aiAssessmentById(context.db, id);
    // Already written or failed meanwhile – a stale hold does nothing.
    if (!assessment || assessment.state !== "requested") return piece.giveUp();
    const defect = await defectForAiAssessment(context.db, assessment.defectId);
    if (!defect) return fail(id, "answer-unusable", piece, context);
    const machineModel = await machineModelOfMachineForAi(context.db, defect.machineId);
    if (!machineModel) return fail(id, "answer-unusable", piece, context);
    // Read once, when the writing begins (ST-120): this list limits the search, is what the chat model is told and is
    // what the command checks references against – a file attached or detached meanwhile changes nothing.
    const files = await filesOfMachineAndModelForAi(context.db, {
      machineId: defect.machineId,
      machineModelId: machineModel.id,
    });
    const fileIds = files.map((file) => file.id);

    const searches = await searchWithTheDefect({
      context,
      openRouter: piece.openRouter,
      text: searchTextOf(defect, assessment.note),
      requestPhotos: assessment.photos,
      fileIds,
    });
    if (!searches.ok) return fail(id, searches.failure, piece, context);
    const { filesSearched } = searches;
    const toRead = whatToRead(defect, searches);
    const foundImages = await readFoundImages(context, toRead.foundImages);
    const request = aiAssessmentChatRequest({
      defect,
      machineModel,
      files,
      note: assessment.note,
      passages: toRead.passages,
      foundImages,
      reportPhotos: await readPhotos(context, toRead.reportPhotos),
      requestPhotos: await readPhotos(context, assessment.photos),
    });
    // The chat model is the one the assessment was requested with – never the one saved meanwhile (invariant).
    const outcome = outcomeOfChat(await piece.openRouter.chat(assessment.chatModel, request));
    if ("failure" in outcome) return fail(id, outcome.failure, piece, context);
    await piece.storeResult((tx) =>
      executeCommand(
        writeAiAssessmentCommand,
        {
          aiAssessmentId: id,
          summary: outcome.summary,
          probableCauses: outcome.probableCauses,
          whatToCheckFirst: outcome.whatToCheckFirst,
          // The command owns the invariant: references to files outside the list read when the writing began are dropped.
          references: outcome.references,
          filesAttached: fileIds,
          filesSearched,
          embeddingModel: searches.embeddingModel,
          cost: piece.openRouter.spent(),
        },
        { actor: { kind: "system" }, db: tx, clock: context.clock },
      ),
    );
  },

  /**
   * POL-UnfinishedAiWorkFails: an AI assessment whose hold ran out without a result is recorded failed as *broken off*
   * and never written again automatically (HS-33, D3). Nothing is read and nothing is sent.
   */
  async recordBrokenOff(tx, id, context) {
    await failIn(tx, id, "broken-off", context);
  },
};

/** Records a failure through the aggregate's own command – only while the assessment is still requested. */
async function fail(
  id: string,
  reason: AssessmentFailureReason,
  piece: HeldPiece,
  context: AiWorkContext,
): Promise<void> {
  await piece.storeResult((tx) => failIn(tx, id, reason, context));
}

function failIn(tx: Database, id: string, reason: AssessmentFailureReason, context: AiWorkContext) {
  return executeCommand(
    failAiAssessmentCommand,
    { aiAssessmentId: id, reason },
    { actor: { kind: "system" }, db: tx, clock: context.clock },
  );
}

type SearchOutcome =
  | {
      ok: true;
      passages: AiIndexHit[];
      images: AiIndexHit[];
      filesSearched: string[];
      embeddingModel: string;
    }
  | { ok: false; failure: AssessmentFailureReason };

/**
 * The AI index is searched with the text, as one search, and with each photo of the request, one search each (user,
 * 2026-10-31). Each takes the fixed number of best text passages and pages or images. AI off stops the search and sends
 * nothing more.
 */
async function searchWithTheDefect({
  context,
  openRouter,
  text,
  requestPhotos,
  fileIds,
}: {
  context: AiWorkContext;
  openRouter: OpenRouterSession;
  text: string;
  requestPhotos: readonly string[];
  fileIds: readonly string[];
}): Promise<SearchOutcome> {
  const scopeWith = (embeddingModel: string) => ({ fileIds, embeddingModel });
  const textAnswer = await openRouter.embed({ kind: "text", text });
  if (typeof textAnswer === "string") return { ok: false, failure: failureOfEmbedding(textAnswer) };
  let embeddingModel = textAnswer.model;
  const filesSearched = await searchedFiles(context.db, scopeWith(embeddingModel));
  const passageHits = await searchAiIndex(context.db, scopeWith(embeddingModel), textAnswer.embedding, "text");
  const imageHits = [...(await searchAiIndex(context.db, scopeWith(embeddingModel), textAnswer.embedding, "image"))];
  for (const photo of requestPhotos) {
    const bytes = await context.storage.readContent(photo);
    if (!bytes) continue;
    const answer = await openRouter.embed({ kind: "image", bytes, contentType: "image/jpeg" });
    if (typeof answer === "string") return { ok: false, failure: failureOfEmbedding(answer) };
    embeddingModel = answer.model;
    imageHits.push(...(await searchAiIndex(context.db, scopeWith(embeddingModel), answer.embedding, "image")));
  }
  return {
    ok: true,
    passages: passageHits,
    images: imageHits,
    filesSearched,
    embeddingModel,
  };
}

/**
 * The found pages and images, each with its image: pages rendered again from their files (ADR 0014 – page images are not
 * kept; each file is read and opened once for all its found pages). What cannot be read any more has none; the reference
 * stays by its title (RM-DefectAiAssessments).
 */
async function readFoundImages(
  context: AiWorkContext,
  found: readonly AiIndexHit[],
): Promise<{ hit: AiIndexHit; image: ChatImage | undefined }[]> {
  const hitsByFile = new Map<string, AiIndexHit[]>();
  for (const hit of found) hitsByFile.set(hit.fileId, [...(hitsByFile.get(hit.fileId) ?? []), hit]);
  const pageImages = new Map<string, Map<number, Uint8Array>>();
  const imageFiles = new Map<string, ChatImage>();
  for (const [fileId, hits] of hitsByFile) {
    const file = await fileForIndexing(context.db, fileId);
    if (!file) continue;
    const bytes = await context.storage.readContent(file.content.name);
    if (!bytes) continue;
    if (hits.some((hit) => hit.kind === "image"))
      imageFiles.set(fileId, { bytes, contentType: file.content.contentType });
    const pages = hits.flatMap((hit) => (hit.kind !== "image" && hit.page !== undefined ? [hit.page] : []));
    if (pages.length > 0) pageImages.set(fileId, await renderPdfPages(bytes, pages));
  }
  return found.map((hit) => {
    if (hit.kind === "image") return { hit, image: imageFiles.get(hit.fileId) };
    const page = hit.page !== undefined ? pageImages.get(hit.fileId)?.get(hit.page) : undefined;
    return { hit, image: page && { bytes: page, contentType: "image/jpeg" } };
  });
}

/** Stored photos in the order given, one after the other – undefined for one that cannot be read any more. */
async function readPhotos(context: AiWorkContext, names: readonly string[]): Promise<(Uint8Array | undefined)[]> {
  const photos: (Uint8Array | undefined)[] = [];
  for (const name of names) photos.push(await context.storage.readContent(name));
  return photos;
}
