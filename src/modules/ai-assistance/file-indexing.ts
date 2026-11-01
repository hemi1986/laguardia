import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import type { AiSeam, EmbedInput } from "./ai-seam";
import type { AiIndexItem, IndexingFailureReason } from "./ai-index-entry";

/**
 * Turning one file's content into what the AI index holds of it (ST-106, ADR 0014): a PDF page by page – its text layer
 * as a passage and the page rendered as an image; a Markdown or text file in passages; a PNG, JPEG or WebP image as it
 * is. No OCR. Every item is embedded on its own with the embedding model; one item per request, at most four at a time
 * (ST-105); pages are rendered a few at a time so the page images held at once stay bounded.
 */

/** The page image's bounded size and quality (ST-105: 792 × 1024 px, JPEG quality 75, ≈ 71 KB, 258 tokens a page). */
const PAGE_IMAGE_LONG_EDGE = 1024;
const PAGE_IMAGE_QUALITY = 75;
/** One item per request; up to four requests beside each other (ST-105: no rate limit seen at four). */
const PARALLEL_REQUESTS = 4;
/** How many pages are rendered before their items are embedded – bounds the page images held at once. */
const PAGES_PER_BATCH = 2;
/** A text or Markdown passage is at most this long; longer paragraphs are split (ADR 0014: passages, not whole files). */
const MAX_PASSAGE_LENGTH = 2000;
/**
 * An image file above this many pixels is refused before it is decoded – a decompression bomb must not exhaust the
 * worker's memory (a museum photo or scan is far below it; the page images this story makes are ~0.8 megapixels).
 */
const MAX_IMAGE_PIXELS = 100_000_000;

/** What indexing one file ended in. */
export type IndexingOutcome =
  | {
      outcome: "indexed";
      items: Omit<AiIndexItem, "id">[];
      pagesIndexed: number;
      imagesIndexed: number;
      cost: number;
    }
  /** The file cannot be read or its format is not indexed, or OpenRouter refused or did not answer. */
  | { outcome: "failed"; reason: IndexingFailureReason }
  /** AI was turned off meanwhile (or the key or model changed): nothing is stored, the file stays waiting. */
  | { outcome: "given-up" };

/** What the AI index work reads before every request – AI on, the key now, the model the index is built with. */
export type IndexingSettings = { aiOn: boolean; key: string | undefined; embeddingModel: string | undefined };

export type IndexFileOptions = {
  contentType: string;
  bytes: Uint8Array;
  ai: AiSeam;
  /** The embedding model this indexing was started with – every item of the entry must be made with it. */
  embeddingModel: string;
  /** Asked before every request to OpenRouter: AI off, a rotated key or a changed model stops the indexing at once. */
  settings: () => Promise<IndexingSettings>;
};

/** One thing to embed, with where it came from. */
type ItemToEmbed = {
  kind: "passage" | "page-image" | "image";
  page?: number;
  text?: string;
  bytes?: Uint8Array;
  contentType?: string;
};

/** An item that went through OpenRouter, with the cost its request reported. */
type Embedded = { item: Omit<AiIndexItem, "id">; cost: number };

const mediaTypesOf = (contentType: string) => contentType.split(";")[0].trim().toLowerCase();

const isPdf = (contentType: string) => mediaTypesOf(contentType) === "application/pdf";
const isText = (contentType: string) =>
  ["text/plain", "text/markdown", "text/x-markdown"].includes(mediaTypesOf(contentType));
const imageTypes = ["image/png", "image/jpeg", "image/webp"];
const isImage = (contentType: string) => imageTypes.includes(mediaTypesOf(contentType));

export async function indexFileContent({
  contentType,
  bytes,
  ai,
  embeddingModel,
  settings,
}: IndexFileOptions): Promise<IndexingOutcome> {
  if (isPdf(contentType)) return indexPdf({ bytes, ai, embeddingModel, settings });
  if (isText(contentType)) {
    const text = new TextDecoder().decode(bytes);
    const itemsToEmbed: ItemToEmbed[] = passagesOf(text).map((passage) => ({ kind: "passage", text: passage }));
    return indexItems(itemsToEmbed, { ai, embeddingModel, settings }, { pagesIndexed: 0, imagesIndexed: 0 });
  }
  if (isImage(contentType)) {
    // A damaged image – or one whose pixel count is absurd – is a file that cannot be read (ST-106, "not readable").
    // sharp reads the header only and refuses too many pixels before decoding, so it cannot exhaust the worker.
    try {
      const info = await sharp(Buffer.from(bytes), { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
      if (!info.width || !info.height) return { outcome: "failed", reason: "not readable" };
    } catch {
      return { outcome: "failed", reason: "not readable" };
    }
    const itemsToEmbed: ItemToEmbed[] = [{ kind: "image", bytes, contentType: mediaTypesOf(contentType) }];
    return indexItems(itemsToEmbed, { ai, embeddingModel, settings }, { pagesIndexed: 0, imagesIndexed: 1 });
  }
  return { outcome: "failed", reason: "format not indexed" };
}

/** A text, Markdown or image file: its items embedded, no page count. */
async function indexItems(
  itemsToEmbed: ItemToEmbed[],
  embedding: { ai: AiSeam; embeddingModel: string; settings: () => Promise<IndexingSettings> },
  counts: { pagesIndexed: number; imagesIndexed: number },
): Promise<IndexingOutcome> {
  const answer = await embedItems(itemsToEmbed, embedding);
  if (answer.outcome !== "embedded") return answer;
  return {
    outcome: "indexed",
    items: answer.embedded.map((each) => each.item),
    cost: answer.embedded.reduce((sum, each) => sum + each.cost, 0),
    ...counts,
  };
}

function passagesOf(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
  const passages: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    for (const piece of paragraph.length > MAX_PASSAGE_LENGTH ? splitLong(paragraph) : [paragraph]) {
      if (current && current.length + piece.length + 2 > MAX_PASSAGE_LENGTH) {
        passages.push(current);
        current = "";
      }
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) passages.push(current);
  return passages;
}

function splitLong(text: string): string[] {
  const pieces: string[] = [];
  for (let at = 0; at < text.length; at += MAX_PASSAGE_LENGTH) pieces.push(text.slice(at, at + MAX_PASSAGE_LENGTH));
  return pieces;
}

/** Renders every page, batches of pages rendered before their text and page image are embedded (ST-105). */
async function indexPdf({
  bytes,
  ai,
  embeddingModel,
  settings,
}: Omit<IndexFileOptions, "contentType">): Promise<IndexingOutcome> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const assets = pdfjsAssets();
  const loading = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: false,
    wasmUrl: assets("wasm"),
    iccUrl: assets("iccs"),
    standardFontDataUrl: assets("standard_fonts"),
    cMapUrl: assets("cmaps"),
    cMapPacked: true,
  });
  let pdf;
  try {
    pdf = await loading.promise;
  } catch {
    // A damaged, password-protected or empty PDF, or content that is no PDF at all (ST-105).
    await loading.destroy().catch(() => undefined);
    return { outcome: "failed", reason: "not readable" };
  }
  const pages = pdf.numPages;
  const embedded: Embedded[] = [];
  try {
    for (let first = 1; first <= pages; first += PAGES_PER_BATCH) {
      const itemsToEmbed: ItemToEmbed[] = [];
      try {
        for (let number = first; number <= Math.min(first + PAGES_PER_BATCH - 1, pages); number++) {
          const page = await pdf.getPage(number);
          const text = await page.getTextContent();
          const passage = text.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .trim();
          // A scanned page without a text layer has no passage – it is found through its page image (no OCR).
          if (passage) {
            for (const piece of passagesOf(passage)) itemsToEmbed.push({ kind: "passage", page: number, text: piece });
          }
          const image = await renderPage(page as unknown as PdfPage);
          itemsToEmbed.push({ kind: "page-image", page: number, bytes: image, contentType: "image/jpeg" });
        }
      } catch {
        // A page that pdfjs cannot read or render: the whole file fails and nothing of it is kept.
        return { outcome: "failed", reason: "not readable" };
      }
      // Embedding errors are not the file's: they propagate, so the run keeps its hold and the file is recorded broken
      // off later instead of failing permanently as "not readable" (D3 never retries a failed file).
      const answer = await embedItems(itemsToEmbed, { ai, embeddingModel, settings });
      if (answer.outcome !== "embedded") return answer;
      embedded.push(...answer.embedded);
    }
  } finally {
    await loading.destroy().catch(() => undefined);
  }
  return {
    outcome: "indexed",
    items: embedded.map((each) => each.item),
    pagesIndexed: pages,
    // Every page is a page image; a PDF has no separate image files.
    imagesIndexed: pages,
    cost: embedded.reduce((sum, each) => sum + each.cost, 0),
  };
}

/** What rendering one PDF page needs – pdfjs' page, narrowed to the two calls (its types want a DOM canvas). */
type PdfPage = {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: { canvasContext: unknown; viewport: unknown; canvas: unknown }): { promise: Promise<void> };
};

/** One page rendered to a JPEG of bounded size – 1024 px on its long edge (ST-105). */
async function renderPage(page: PdfPage): Promise<Uint8Array> {
  const original = page.getViewport({ scale: 1 });
  const scale = Math.min(PAGE_IMAGE_LONG_EDGE / Math.max(original.width, original.height), 2);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return canvas.encode("jpeg", PAGE_IMAGE_QUALITY);
}

/** The pdfjs assets of the installed package – wasm (JBIG2, JPEG 2000), ICC profiles, fonts and CMaps (ST-105). */
function pdfjsAssets(): (folder: "wasm" | "iccs" | "standard_fonts" | "cmaps") => string {
  const require = createRequire(import.meta.url);
  const root = dirname(require.resolve("pdfjs-dist/package.json"));
  // pdfjs expects a folder URL; a local path with a trailing slash works locally and in the traced function alike.
  return (folder) => `${join(root, folder)}/`;
}

/**
 * The pages an AI assessment sends, rendered again from one PDF file (ST-107, ADR 0014): found pages are sent as
 * images, and page images are not kept. The file is read and opened once for all its pages; a page that cannot be
 * rendered is left out, so the assessment is written without it.
 */
export async function renderPdfPages(
  bytes: Uint8Array,
  pageNumbers: readonly number[],
): Promise<Map<number, Uint8Array>> {
  const wanted = [...new Set(pageNumbers)].filter((page) => Number.isInteger(page) && page > 0);
  if (wanted.length === 0) return new Map();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const assets = pdfjsAssets();
  const loading = pdfjs.getDocument({
    // pdfjs may transfer the buffer: a copy keeps the caller's bytes untouched.
    data: bytes.slice(),
    useSystemFonts: false,
    wasmUrl: assets("wasm"),
    iccUrl: assets("iccs"),
    standardFontDataUrl: assets("standard_fonts"),
    cMapUrl: assets("cmaps"),
    cMapPacked: true,
  });
  const rendered = new Map<number, Uint8Array>();
  try {
    const pdf = await loading.promise;
    for (const pageNumber of wanted) {
      if (pageNumber > pdf.numPages) continue;
      try {
        rendered.set(pageNumber, await renderPage((await pdf.getPage(pageNumber)) as unknown as PdfPage));
      } catch {
        // A page that cannot be rendered is left out – the others are still sent.
      }
    }
  } catch {
    // A file that cannot be opened renders no page.
  } finally {
    await loading.destroy().catch(() => undefined);
  }
  return rendered;
}

type EmbedAnswer =
  | { outcome: "embedded"; embedded: Embedded[] }
  | { outcome: "given-up" }
  | { outcome: "failed"; reason: IndexingFailureReason };

/**
 * Embeds the items at most four requests at a time – one item per request. Before every request the settings are read:
 * AI off gives the file up, a rotated key is used for this request, and a changed embedding model gives the file up so
 * the entry never mixes two models.
 */
async function embedItems(
  itemsToEmbed: ItemToEmbed[],
  { ai, embeddingModel, settings }: { ai: AiSeam; embeddingModel: string; settings: () => Promise<IndexingSettings> },
): Promise<EmbedAnswer> {
  const embedded: Embedded[] = [];
  for (let at = 0; at < itemsToEmbed.length; at += PARALLEL_REQUESTS) {
    const answers = await Promise.all(
      itemsToEmbed
        .slice(at, at + PARALLEL_REQUESTS)
        .map(async (item): Promise<Embedded | "given-up" | IndexingFailureReason> => {
          const now = await settings();
          if (!now.aiOn || !now.key || now.embeddingModel !== embeddingModel) return "given-up";
          const input: EmbedInput =
            item.kind === "passage"
              ? { kind: "text", text: item.text! }
              : { kind: "image", bytes: item.bytes!, contentType: item.contentType! };
          const answer = await ai.embed(now.key, embeddingModel, input);
          if (answer === "unreachable") return "OpenRouter not reachable";
          if (answer === "refused") return "OpenRouter refused";
          return {
            item: {
              kind: item.kind,
              ...(item.page !== undefined && { page: item.page }),
              ...(item.kind === "passage" && { text: item.text! }),
              embedding: answer.embedding,
            },
            cost: answer.cost,
          };
        }),
    );
    if (answers.includes("given-up")) return { outcome: "given-up" };
    const failure = answers.find((answer): answer is IndexingFailureReason => typeof answer === "string");
    if (failure) return { outcome: "failed", reason: failure };
    embedded.push(...(answers as Embedded[]));
  }
  return { outcome: "embedded", embedded };
}
