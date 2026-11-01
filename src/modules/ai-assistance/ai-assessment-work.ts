import { executeCommand, type Database } from "@/platform/command";
import { fileForIndexing, filesOfMachineAndModelForAi, machineModelOfMachineForAi } from "@/modules/collection";
import { defectForAiAssessment } from "@/modules/repair";
import type { AssessmentFailureReason } from "./ai-assessment";
import { aiAssessmentById, requestedAiAssessmentIds } from "./ai-assessments";
import { buildAiAssessmentPrompt, parseAiAssessmentAnswer } from "./ai-assessment-writing";
import { aiAssessmentSettings } from "./ai-settings";
import { renderPdfPage } from "./file-indexing";
import { searchAiIndex, searchedFiles, type AiIndexHit } from "./ai-index-search";
import type { AiWorkContext, AiWorkKind, HeldPiece } from "./ai-work";
import { failAiAssessmentCommand, writeAiAssessmentCommand } from "./write-ai-assessment-command";
import type { ChatFailure, ChatImage } from "./ai-seam";

/**
 * Writing an AI assessment as a kind of the background work (ST-107, ADR 0015, POL-RequestedAiAssessmentIsWritten).
 * A run takes one whole AI assessment: what is known about the defect is read outside any transaction from Repair and
 * Collection, the AI index is searched with the text and with each photo of the request, the chat model answers, and
 * only the storage of the answer is one short transaction that ends the hold.
 */
export const AI_ASSESSMENT_KIND = "ai-assessment";

/** How many of the newest problem report photos the chat model is sent (user, 2026-10-31). */
export const AI_ASSESSMENT_REPORT_PHOTOS = 10;
/** How many found pages and images one AI assessment sends at most, merged and without duplicates (user, 2026-10-31). */
export const AI_ASSESSMENT_FOUND_IMAGES = 12;

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
    const settings = await aiAssessmentSettings(context.db, context.ai);
    const { key, chatModel, embeddingModel } = settings;
    // AI turned off before it started: nothing is sent, and the request is failed as *AI off* (rule).
    if (!settings.aiOn || !key || !chatModel || !embeddingModel) return fail(id, "ai-off", piece, context);
    const assessment = await aiAssessmentById(context.db, id);
    // Already written or failed meanwhile – a stale hold does nothing.
    if (!assessment || assessment.state !== "requested") return piece.giveUp();
    const defect = await defectForAiAssessment(context.db, assessment.defectId);
    if (!defect) return fail(id, "answer-unusable", piece, context);
    const machineModel = await machineModelOfMachineForAi(context.db, defect.machineId);
    if (!machineModel) return fail(id, "answer-unusable", piece, context);
    const files = await filesOfMachineAndModelForAi(context.db, {
      machineId: defect.machineId,
      machineModelId: machineModel.id,
    });
    const scope = {
      machineId: defect.machineId,
      machineModelId: machineModel.id,
      embeddingModel,
    };

    // The report photos go with the prompt – only the 10 newest (CMD-WriteAiAssessment's fixed number).
    const reportPhotos = defect.problemReports
      .flatMap(({ photo, reportedAt }) => (photo ? [{ photo, reportedAt }] : []))
      .sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime())
      .slice(0, AI_ASSESSMENT_REPORT_PHOTOS)
      .map(({ photo }) => photo);
    const requestPhotos = assessment.photos;

    const searches = await searchWithTheDefect(
      defect.title,
      defect.problemReports.map((each) => each.description),
      assessment.note,
      requestPhotos,
      {
        context,
        key,
        embeddingModel,
        scope,
      },
    );
    if (!searches.ok) return fail(id, searches.failure, piece, context);
    const { passages, images, embeddingCost } = searches;
    const prompt = buildAiAssessmentPrompt({
      source: { defect, machineModel },
      files,
      hits: { passages, images },
      note: assessment.note,
      photos: { reportPhotos: reportPhotos.length, requestPhotos: requestPhotos.length },
    });
    const sent = await imagesToSend(context, images, reportPhotos, requestPhotos);
    const answer = await context.ai.ai.chat(key, chatModel, {
      system: prompt.system,
      text: prompt.text,
      images: sent,
    });
    if ("failure" in answer) return fail(id, answer.failure, piece, context);
    const parsed = parseAiAssessmentAnswer(answer.content);
    if (!parsed) return fail(id, "answer-unusable", piece, context);
    // A reference to any other file than the defect's machine's or its machine model's is dropped (rule); each is kept once.
    const ownFiles = new Set(files.map((file) => file.id));
    const references = parsed.references
      .filter((reference) => ownFiles.has(reference.fileId))
      .filter(
        (reference, index, all) =>
          all.findIndex((each) => each.fileId === reference.fileId && each.page === reference.page) === index,
      );
    const filesSearched = await searchedFiles(context.db, scope);
    await piece.storeResult((tx) =>
      executeCommand(
        writeAiAssessmentCommand,
        {
          aiAssessmentId: id,
          summary: parsed.summary,
          probableCauses: parsed.probableCauses,
          whatToCheckFirst: parsed.whatToCheckFirst,
          references,
          filesSearched,
          embeddingModel,
          cost: embeddingCost + answer.cost,
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
  | { ok: true; passages: AiIndexHit[]; images: AiIndexHit[]; embeddingCost: number }
  | { ok: false; failure: ChatFailure | "answer-unusable" };

/**
 * The AI index is searched with the text – the defect title, the descriptions of its problem reports and the note of
 * the request, as one search – and with each photo of the request, one search each (user, 2026-10-31). Each takes the
 * fixed number of best text passages and pages or images; the images are merged, each once, and cut to the fixed total.
 */
async function searchWithTheDefect(
  title: string,
  descriptions: string[],
  note: string | undefined,
  requestPhotos: readonly string[],
  {
    context,
    key,
    embeddingModel,
    scope,
  }: {
    context: AiWorkContext;
    key: string;
    embeddingModel: string;
    scope: { machineId: string; machineModelId: string; embeddingModel: string };
  },
): Promise<SearchOutcome> {
  const text = [title, ...descriptions, note ?? ""].filter((part) => part.trim()).join("\n\n");
  let embeddingCost = 0;
  const textAnswer = await context.ai.ai.embed(key, embeddingModel, { kind: "text", text });
  if (textAnswer === "unreachable") return { ok: false, failure: "openrouter-not-reachable" };
  if (textAnswer === "refused") return { ok: false, failure: "key-invalid" };
  embeddingCost += textAnswer.cost;
  const passageHits = await searchAiIndex(context.db, scope, textAnswer.embedding, "text");
  const imageHits: AiIndexHit[] = [...(await searchAiIndex(context.db, scope, textAnswer.embedding, "image"))];
  for (const photo of requestPhotos) {
    const bytes = await context.storage.readContent(photo);
    if (!bytes) continue;
    const answer = await context.ai.ai.embed(key, embeddingModel, {
      kind: "image",
      bytes,
      contentType: "image/jpeg",
    });
    if (answer === "unreachable") return { ok: false, failure: "openrouter-not-reachable" };
    if (answer === "refused") return { ok: false, failure: "key-invalid" };
    embeddingCost += answer.cost;
    imageHits.push(...(await searchAiIndex(context.db, scope, answer.embedding, "image")));
  }
  return {
    ok: true,
    passages: unique(passageHits),
    images: unique(imageHits).slice(0, AI_ASSESSMENT_FOUND_IMAGES),
    embeddingCost,
  };
}

/** Each found item once – a passage and a page are told apart by their kind and page. */
function unique(hits: readonly AiIndexHit[]): AiIndexHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = `${hit.fileId}:${hit.kind}:${hit.page ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The images one chat request sends: the found pages, rendered again from their files (ADR 0014 – page images are not
 * kept), then the photos of the problem reports and of the request. An image that cannot be read any more is left out;
 * the reference stays by its title (RM-DefectAiAssessments).
 */
async function imagesToSend(
  context: AiWorkContext,
  found: readonly AiIndexHit[],
  reportPhotos: readonly string[],
  requestPhotos: readonly string[],
): Promise<ChatImage[]> {
  const images: ChatImage[] = [];
  for (const hit of found) {
    const file = await fileForIndexing(context.db, hit.fileId);
    if (!file) continue;
    const bytes = await context.storage.readContent(file.content.name);
    if (!bytes) continue;
    if (hit.kind === "image") {
      images.push({ bytes, contentType: file.content.contentType });
      continue;
    }
    if (hit.page === undefined) continue;
    const page = await renderPdfPage(bytes, hit.page);
    if (page) images.push({ bytes: page, contentType: "image/jpeg" });
  }
  for (const photo of [...reportPhotos, ...requestPhotos]) {
    const bytes = await context.storage.readContent(photo);
    if (bytes) images.push({ bytes, contentType: "image/jpeg" });
  }
  return images;
}
