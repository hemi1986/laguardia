import { executeCommand, type Database } from "@/platform/command";
import { fileForIndexing, filesOfMachineAndModelForAi, machineModelOfMachineForAi } from "@/modules/collection";
import { defectForAiAssessment } from "@/modules/repair";
import type { AssessmentFailureReason } from "./ai-assessment";
import { aiAssessmentById, requestedAiAssessmentIds } from "./ai-assessments";
import { buildAiAssessmentPrompt, parseAiAssessmentAnswer } from "./ai-assessment-writing";
import { aiAssessmentSettings, type AiAssessmentSettings } from "./ai-settings";
import { renderPdfPages } from "./file-indexing";
import { searchAiIndex, searchedFiles, type AiIndexHit } from "./ai-index-search";
import type { AiWorkContext, AiWorkKind, HeldPiece } from "./ai-work";
import { failAiAssessmentCommand, writeAiAssessmentCommand } from "./write-ai-assessment-command";
import type { ChatFailure, ChatImage } from "./ai-seam";

/**
 * Writing an AI assessment as a kind of the background work (ST-107, ADR 0015, POL-RequestedAiAssessmentIsWritten).
 * A run takes one whole AI assessment: what is known about the defect is read outside any transaction from Repair and
 * Collection, the AI index is searched with the text and with each photo of the request, the chat model answers, and
 * only the storage of the answer is one short transaction that ends the hold. The settings are read again before every
 * request, so turning AI off stops the writing and sends nothing more (CMD-WriteAiAssessment rule).
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
    const settings = () => aiAssessmentSettings(context.db, context.ai);
    const now = await settings();
    // AI turned off before it started: nothing is sent, and the request is failed as *AI off* (rule).
    if (!now.aiOn) return fail(id, "ai-off", piece, context);
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

    // The report photos go with the prompt – only the 10 newest (CMD-WriteAiAssessment's fixed number).
    const reportPhotos = defect.problemReports
      .flatMap(({ photo, reportedAt }) => (photo ? [{ photo, reportedAt }] : []))
      .sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime())
      .slice(0, AI_ASSESSMENT_REPORT_PHOTOS)
      .map(({ photo }) => photo);
    const requestPhotos = assessment.photos;

    const searches = await searchWithTheDefect({
      context,
      settings,
      title: defect.title,
      descriptions: defect.problemReports.map((each) => each.description),
      note: assessment.note,
      requestPhotos,
      machineId: defect.machineId,
      machineModelId: machineModel.id,
    });
    if (!searches.ok) return fail(id, searches.failure, piece, context);
    const { passages, images, embeddingCost, filesSearched } = searches;
    // The images are assembled first: the prompt names only those that are actually sent (a removed file or a page
    // that cannot be rendered is left out rather than shifting every later image).
    const sent = await imagesToSend(context, images, reportPhotos, requestPhotos);
    const prompt = buildAiAssessmentPrompt({
      source: { defect, machineModel },
      files,
      hits: { passages, images: sent.found },
      note: assessment.note,
      photos: { reportPhotos: sent.reportPhotos, requestPhotos: sent.requestPhotos },
    });
    const beforeChat = await settings();
    // AI turned off while searching: nothing more is sent (rule).
    if (!beforeChat.aiOn || !beforeChat.key) return fail(id, "ai-off", piece, context);
    // The chat model is the one the assessment was requested with – never the one saved meanwhile (invariant).
    const answer = await context.ai.ai.chat(beforeChat.key, assessment.chatModel, {
      system: prompt.system,
      text: prompt.text,
      images: sent.images,
    });
    if ("failure" in answer) return fail(id, answer.failure, piece, context);
    const parsed = parseAiAssessmentAnswer(answer.content);
    if (!parsed) return fail(id, "answer-unusable", piece, context);
    await piece.storeResult((tx) =>
      executeCommand(
        writeAiAssessmentCommand,
        {
          aiAssessmentId: id,
          summary: parsed.summary,
          probableCauses: parsed.probableCauses,
          whatToCheckFirst: parsed.whatToCheckFirst,
          // The command owns the invariant: references to files outside the defect's machine and its model are dropped.
          references: parsed.references,
          filesSearched,
          embeddingModel: searches.embeddingModel,
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
  | {
      ok: true;
      passages: AiIndexHit[];
      images: AiIndexHit[];
      embeddingCost: number;
      filesSearched: string[];
      embeddingModel: string;
    }
  | { ok: false; failure: ChatFailure | "ai-off" };

/**
 * The AI index is searched with the text – the defect title, the descriptions of its problem reports and the note of
 * the request, as one search – and with each photo of the request, one search each (user, 2026-10-31). Each takes the
 * fixed number of best text passages and pages or images; the images are merged, each once, and cut to the fixed total.
 * The settings are read again before every embedding request: AI off stops the search and sends nothing more.
 */
async function searchWithTheDefect({
  context,
  settings,
  title,
  descriptions,
  note,
  requestPhotos,
  machineId,
  machineModelId,
}: {
  context: AiWorkContext;
  settings: () => Promise<AiAssessmentSettings>;
  title: string;
  descriptions: string[];
  note: string | undefined;
  requestPhotos: readonly string[];
  machineId: string;
  machineModelId: string;
}): Promise<SearchOutcome> {
  const text = [title, ...descriptions, note ?? ""].filter((part) => part.trim()).join("\n\n");
  let embeddingCost = 0;
  let filesSearched: string[] = [];
  let embeddingModel = "";
  const scopes = async (): Promise<
    | { key: string; model: string; scope: { machineId: string; machineModelId: string; embeddingModel: string } }
    | "ai-off"
  > => {
    const now = await settings();
    if (!now.aiOn || !now.key || !now.embeddingModel) return "ai-off";
    embeddingModel = now.embeddingModel;
    return {
      key: now.key,
      model: now.embeddingModel,
      scope: { machineId, machineModelId, embeddingModel: now.embeddingModel },
    };
  };
  const first = await scopes();
  if (first === "ai-off") return { ok: false, failure: "ai-off" };
  const textAnswer = await context.ai.ai.embed(first.key, first.model, { kind: "text", text });
  if (textAnswer === "unreachable") return { ok: false, failure: "openrouter-not-reachable" };
  if (textAnswer === "refused") return { ok: false, failure: "key-invalid" };
  embeddingCost += textAnswer.cost;
  filesSearched = await searchedFiles(context.db, first.scope);
  const passageHits = await searchAiIndex(context.db, first.scope, textAnswer.embedding, "text");
  const imageHits: AiIndexHit[] = [...(await searchAiIndex(context.db, first.scope, textAnswer.embedding, "image"))];
  for (const photo of requestPhotos) {
    const bytes = await context.storage.readContent(photo);
    if (!bytes) continue;
    const current = await scopes();
    if (current === "ai-off") return { ok: false, failure: "ai-off" };
    const answer = await context.ai.ai.embed(current.key, current.model, {
      kind: "image",
      bytes,
      contentType: "image/jpeg",
    });
    if (answer === "unreachable") return { ok: false, failure: "openrouter-not-reachable" };
    if (answer === "refused") return { ok: false, failure: "key-invalid" };
    embeddingCost += answer.cost;
    imageHits.push(...(await searchAiIndex(context.db, current.scope, answer.embedding, "image")));
  }
  return {
    ok: true,
    passages: unique(passageHits),
    images: unique(imageHits).slice(0, AI_ASSESSMENT_FOUND_IMAGES),
    embeddingCost,
    filesSearched,
    embeddingModel,
  };
}

/** Each found index item once – distinct passages of one file or page are distinct hits. */
function unique(hits: readonly AiIndexHit[]): AiIndexHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    if (seen.has(hit.id)) return false;
    seen.add(hit.id);
    return true;
  });
}

/** What one chat request sends: the images, and the counts the prompt names for the photos actually attached. */
type ImagesToSend = { images: ChatImage[]; found: AiIndexHit[]; reportPhotos: number; requestPhotos: number };

/**
 * The images one chat request sends: the found pages, rendered again from their files (ADR 0014 – page images are not
 * kept; each file is read and opened once for all its found pages), then the photos of the problem reports and of the
 * request. An image that cannot be read any more is left out; the reference stays by its title (RM-DefectAiAssessments).
 */
async function imagesToSend(
  context: AiWorkContext,
  found: readonly AiIndexHit[],
  reportPhotos: readonly string[],
  requestPhotos: readonly string[],
): Promise<ImagesToSend> {
  const hitsByFile = new Map<string, AiIndexHit[]>();
  for (const hit of found) hitsByFile.set(hit.fileId, [...(hitsByFile.get(hit.fileId) ?? []), hit]);
  const pageImages = new Map<string, Map<number, Uint8Array>>();
  const imageFiles = new Map<string, { bytes: Uint8Array; contentType: string }>();
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

  const images: ChatImage[] = [];
  const sentFound: AiIndexHit[] = [];
  for (const hit of found) {
    if (hit.kind === "image") {
      const image = imageFiles.get(hit.fileId);
      if (!image) continue;
      images.push(image);
      sentFound.push(hit);
      continue;
    }
    const page = hit.page !== undefined ? pageImages.get(hit.fileId)?.get(hit.page) : undefined;
    if (!page) continue;
    images.push({ bytes: page, contentType: "image/jpeg" });
    sentFound.push(hit);
  }
  let sentReportPhotos = 0;
  for (const photo of reportPhotos) {
    const bytes = await context.storage.readContent(photo);
    if (!bytes) continue;
    images.push({ bytes, contentType: "image/jpeg" });
    sentReportPhotos += 1;
  }
  let sentRequestPhotos = 0;
  for (const photo of requestPhotos) {
    const bytes = await context.storage.readContent(photo);
    if (!bytes) continue;
    images.push({ bytes, contentType: "image/jpeg" });
    sentRequestPhotos += 1;
  }
  return { images, found: sentFound, reportPhotos: sentReportPhotos, requestPhotos: sentRequestPhotos };
}
