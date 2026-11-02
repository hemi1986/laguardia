import type { FileOfAiAssessmentMachine, MachineModelOfMachine } from "@/modules/collection";
import type { DefectForAiAssessment } from "@/modules/repair";
import type { AiAssessmentReference, AssessmentFailureReason } from "./ai-assessment";
import type { AiIndexHit } from "./ai-index-search";
import type { ChatAnswer, ChatImage, ChatInput } from "./ai-seam";
import type { SessionStopped } from "./open-router-session";

/**
 * What CMD-WriteAiAssessment says to the chat model, and how its answer becomes an AI assessment (ST-107): what to search
 * with and which photos to send, the chat request made of what was read, and the answer as the assessment's parts or the
 * reason it failed. No I/O: the work reads and stores (`ai-assessment-work.ts`). The prompt is built from what Repair and
 * Collection publish – never from a table of theirs – and the answer is read as structured data; OpenRouter's prose never
 * reaches the domain (ADR 0014). The parser drops nothing by itself: the command checks references against the defect's
 * files and drops the others (CMD-WriteAiAssessment rule).
 */

/** How many of the newest problem report photos the chat model is sent (user, 2026-10-31). */
const REPORT_PHOTOS = 10;
/** How many found pages and images one AI assessment sends at most, merged and without duplicates (user, 2026-10-31). */
const FOUND_IMAGES = 12;

/** What was read for one chat request. What could not be read any more is undefined there, and is left out. */
export type AiAssessmentMaterial = {
  defect: DefectForAiAssessment;
  machineModel: MachineModelOfMachine;
  /** The defect's machine's and machine model's files – the only ones a reference may name. */
  files: FileOfAiAssessmentMachine[];
  note: string | undefined;
  /** The found text passages, sent as text. */
  passages: AiIndexHit[];
  /** The found pages and images (`whatToRead`), each with its image. */
  foundImages: { hit: AiIndexHit; image: ChatImage | undefined }[];
  reportPhotos: (Uint8Array | undefined)[];
  requestPhotos: (Uint8Array | undefined)[];
};

/** What the AI index is searched with: the defect title, the descriptions of its problem reports and the note, as one. */
export function searchTextOf(defect: DefectForAiAssessment, note: string | undefined): string {
  return [defect.title, ...defect.problemReports.map((each) => each.description), note ?? ""]
    .filter((part) => part.trim())
    .join("\n\n");
}

/** What the searches found and the defect holds that is worth reading for the chat request – the caps are applied here. */
export function whatToRead(
  defect: DefectForAiAssessment,
  found: { passages: readonly AiIndexHit[]; images: readonly AiIndexHit[] },
): { passages: AiIndexHit[]; foundImages: AiIndexHit[]; reportPhotos: string[] } {
  return {
    passages: uniqueHits(found.passages),
    foundImages: uniqueHits(found.images).slice(0, FOUND_IMAGES),
    // The photos of the newest problem reports that have one, the newest first.
    reportPhotos: defect.problemReports
      .flatMap(({ photo, reportedAt }) => (photo ? [{ photo, reportedAt }] : []))
      .sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime())
      .slice(0, REPORT_PHOTOS)
      .map(({ photo }) => photo),
  };
}

/** Each found index item once – distinct passages of one file or page are distinct hits. */
function uniqueHits(hits: readonly AiIndexHit[]): AiIndexHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    if (seen.has(hit.id)) return false;
    seen.add(hit.id);
    return true;
  });
}

/**
 * The chat request of one AI assessment: the found pages and images, then the problem reports' photos, then the
 * request's. The prompt names only what is really sent, so an image left out does not shift every later one.
 */
export function aiAssessmentChatRequest(material: AiAssessmentMaterial): ChatInput {
  const found = material.foundImages.flatMap(({ hit, image }) => (image ? [{ hit, image }] : []));
  const photos = (all: (Uint8Array | undefined)[]) =>
    all.flatMap((bytes) => (bytes ? [{ bytes, contentType: "image/jpeg" }] : []));
  const reportPhotos = photos(material.reportPhotos);
  const requestPhotos = photos(material.requestPhotos);
  const prompt = buildAiAssessmentPrompt({
    ...material,
    images: found.map(({ hit }) => hit),
    reportPhotos: reportPhotos.length,
    requestPhotos: requestPhotos.length,
  });
  return { ...prompt, images: [...found.map(({ image }) => image), ...reportPhotos, ...requestPhotos] };
}

/** Why a search stopped: its embedding request got no embedding. */
export function failureOfEmbedding(answer: "stopped" | "refused" | "unreachable"): AssessmentFailureReason {
  if (answer === "stopped") return "ai-off";
  return answer === "unreachable" ? "openrouter-not-reachable" : "key-invalid";
}

/** What the chat model's request came to: the AI assessment's parts, or why it failed. */
export function outcomeOfChat(
  answer: ChatAnswer | SessionStopped,
): AiAssessmentAnswer | { failure: AssessmentFailureReason } {
  // AI turned off while searching: nothing more was sent (rule).
  if (answer === "stopped") return { failure: "ai-off" };
  if ("failure" in answer) return answer;
  return parseAiAssessmentAnswer(answer.content) ?? { failure: "answer-unusable" };
}

/** The chat model's answer, read as the AI assessment's parts. */
type AiAssessmentAnswer = {
  summary: string;
  probableCauses: string[];
  whatToCheckFirst: string[];
  /** The files and pages the model named – checked by the command before they are stored. */
  references: AiAssessmentReference[];
};

/** The answer is untrusted: these bounds keep one answer from becoming an arbitrarily large stored row (ST-107). */
const MAX_SUMMARY = 4000;
const MAX_TEXTS = 20;
const MAX_TEXT = 500;
const MAX_REFERENCES = 20;

const systemPrompt = [
  "Du bist die KI-Unterstützung eines Flipper- und Arcade-Museums.",
  "Du bekommst einen offenen Defekt, seine Meldungen und Arbeitsschritte, das Gerätemodell, die zuletzt behobenen Defekte und Fundstellen aus Handbüchern und Schaltplänen.",
  "Schätze den Defekt ein: eine kurze Zusammenfassung, wahrscheinliche Ursachen (die wahrscheinlichste zuerst) und was zuerst zu prüfen ist.",
  "Nenne als Fundstellen nur Dateien aus der Liste „Dateien“ und, bei PDFs, die Seite; nutze die Datei-ID.",
  "Antworte nur mit einem JSON-Objekt in dieser Form:",
  '{"summary": "…", "probableCauses": ["…"], "whatToCheckFirst": ["…"], "references": [{"file": "<Datei-ID>", "page": 12}]}',
].join("\n");

/**
 * Builds the chat request's text for one AI assessment (ST-107). Everything is sent as data, the found passages as
 * text, and the found pages and images follow as images with the labels named here.
 */
function buildAiAssessmentPrompt({
  defect,
  machineModel,
  files,
  passages,
  images,
  note,
  reportPhotos,
  requestPhotos,
}: Pick<AiAssessmentMaterial, "defect" | "machineModel" | "files" | "passages" | "note"> & {
  /** The found pages and images really sent. */
  images: AiIndexHit[];
  /** How many photos of problem reports and of the request follow the found pages and images. */
  reportPhotos: number;
  requestPhotos: number;
}): { system: string; text: string } {
  const sections = [
    `Defekt:\n${JSON.stringify({ titel: defect.title, priorität: defect.priority, pausiert: defect.holdReason ?? null }, null, 2)}`,
    `Meldungen:\n${JSON.stringify(
      defect.problemReports.map(({ description }) => description),
      null,
      2,
    )}`,
    `Arbeitsschritte:\n${JSON.stringify(
      defect.workLog.map(({ whatWasDone, partsUsed }) => ({ gemacht: whatWasDone, teile: partsUsed ?? null })),
      null,
      2,
    )}`,
    `Gerätemodell:\n${JSON.stringify(
      {
        titel: machineModel.title,
        hersteller: machineModel.manufacturer,
        jahr: machineModel.year ?? null,
        kategorie: machineModel.machineCategory,
        technik: machineModel.technology ?? null,
      },
      null,
      2,
    )}`,
    `Zuletzt behobene Defekte:\n${JSON.stringify(
      defect.latestResolved.map(({ title, closingNote }) => ({ titel: title, abschlussnotiz: closingNote })),
      null,
      2,
    )}`,
    `Anfrage-Notiz:\n${JSON.stringify(note ?? null)}`,
    `Dateien:\n${JSON.stringify(
      files.map(({ id, title, removed }) => ({ id, titel: title, entfernt: removed })),
      null,
      2,
    )}`,
    `Gefundene Textstellen:\n${JSON.stringify(
      passages.map(({ fileId, page, text }) => ({ datei: fileId, seite: page ?? null, text: text ?? "" })),
      null,
      2,
    )}`,
    `Gefundene Seiten und Bilder (als Bilder mitgeschickt, in dieser Reihenfolge):\n${JSON.stringify(
      images.map(({ fileId, page }, index) => ({ bild: index + 1, datei: fileId, seite: page ?? null })),
      null,
      2,
    )}`,
    `Fotos der Meldungen (als Bilder mitgeschickt, danach): ${reportPhotos}`,
    `Fotos der Anfrage (als Bilder mitgeschickt, zuletzt): ${requestPhotos}`,
  ];
  return { system: systemPrompt, text: sections.join("\n\n") };
}

/**
 * Reads the chat model's answer as an AI assessment (ST-107): a JSON object with a usable summary and, optionally, the
 * ranked causes, what to check first and references. Undefined when it is not such an answer – an empty summary or
 * unreadable content is *answer unusable* (ST-108).
 */
export function parseAiAssessmentAnswer(content: string): AiAssessmentAnswer | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const answer = parsed as Record<string, unknown>;
  const summary = typeof answer.summary === "string" ? answer.summary.trim().slice(0, MAX_SUMMARY) : "";
  if (!summary) return undefined;
  return {
    summary,
    probableCauses: textsOf(answer.probableCauses),
    whatToCheckFirst: textsOf(answer.whatToCheckFirst),
    references: referencesOf(answer.references).slice(0, MAX_REFERENCES),
  };
}

/** A list of non-empty texts – anything else in it is left out, a missing list is empty, and the list is bounded. */
function textsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => (typeof entry === "string" && entry.trim() ? [entry.trim().slice(0, MAX_TEXT)] : []))
    .slice(0, MAX_TEXTS);
}

/** The references the answer names: a file ID and, for a page, a positive whole number. */
function referencesOf(value: unknown): AiAssessmentReference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const { file, page } = entry as Record<string, unknown>;
    if (typeof file !== "string" || !file) return [];
    const pageNumber = typeof page === "number" && Number.isInteger(page) && page > 0 ? page : undefined;
    return [{ fileId: file, ...(pageNumber !== undefined && { page: pageNumber }) }];
  });
}
