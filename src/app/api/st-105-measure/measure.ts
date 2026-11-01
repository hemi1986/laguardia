import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { sql } from "drizzle-orm";
import { database } from "@/platform/database";
import { s3Storage } from "@/platform/storage";

/**
 * ST-105 spike – THROW-AWAY measuring code, never merged. Reads a PDF from the store, takes every page's text layer,
 * renders every page as an image of bounded size and embeds both through OpenRouter, measuring time, memory and cost.
 * The OpenRouter key comes only from the preview-scoped variable ST105_OPENROUTER_KEY and is never logged or returned.
 */

const BASE = "https://openrouter.ai/api/v1";
const PROVIDER = { data_collection: "deny", zdr: true } as const;
const DIMENSIONS = 1536;

export type MeasureOptions = {
  fileId: string;
  model: string;
  maxSide: number;
  quality: number;
  batch: number;
  concurrency: number;
  maxPages?: number;
  embed: boolean;
  stopAfterSeconds: number;
};

type Usage = { prompt_tokens?: number; total_tokens?: number; cost?: number; prompt_tokens_details?: unknown };

function key(): string {
  const value = process.env.ST105_OPENROUTER_KEY;
  if (!value) throw new Error("ST105_OPENROUTER_KEY is not set");
  return value;
}

/** Peak memory, sampled every 100 ms. */
function memorySampler() {
  let rss = 0;
  let heap = 0;
  let external = 0;
  const sample = () => {
    const m = process.memoryUsage();
    rss = Math.max(rss, m.rss);
    heap = Math.max(heap, m.heapUsed);
    external = Math.max(external, m.external + m.arrayBuffers);
  };
  sample();
  const timer = setInterval(sample, 100);
  const mb = (n: number) => Math.round(n / 1_048_576);
  return {
    stop() {
      clearInterval(timer);
      sample();
      return { peakRssMb: mb(rss), peakHeapMb: mb(heap), peakExternalMb: mb(external) };
    },
  };
}

type EmbedInput = { content: ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] };

type EmbedResult = {
  ok: boolean;
  status: number;
  ms: number;
  sizes: number[];
  usage?: Usage;
  provider?: string;
  error?: string;
  retries: number;
};

export async function embed(model: string, input: EmbedInput[]): Promise<EmbedResult> {
  let retries = 0;
  for (;;) {
    const started = performance.now();
    let response: Response;
    try {
      response = await fetch(`${BASE}/embeddings`, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(120_000),
        headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" },
        body: JSON.stringify({ model, input, dimensions: DIMENSIONS, encoding_format: "float", provider: PROVIDER }),
      });
    } catch (error) {
      if (retries < 3) {
        retries++;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** retries));
        continue;
      }
      return { ok: false, status: 0, ms: performance.now() - started, sizes: [], error: String(error), retries };
    }
    const text = await response.text();
    const ms = performance.now() - started;
    if ((response.status === 429 || response.status >= 500) && retries < 3) {
      retries++;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** retries));
      continue;
    }
    if (!response.ok) return { ok: false, status: response.status, ms, sizes: [], error: text.slice(0, 600), retries };
    try {
      const body = JSON.parse(text) as {
        data: { embedding: number[] | string }[];
        usage?: Usage;
        provider?: string;
      };
      return {
        ok: true,
        status: response.status,
        ms,
        sizes: body.data.map((d) => (Array.isArray(d.embedding) ? d.embedding.length : -1)),
        usage: body.usage,
        provider: body.provider,
        retries,
      };
    } catch {
      return { ok: false, status: response.status, ms, sizes: [], error: `not JSON: ${text.slice(0, 300)}`, retries };
    }
  }
}

async function pdfjs() {
  const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return lib;
}

function pdfjsDir(): string {
  return path.join(process.cwd(), "node_modules", "pdfjs-dist");
}

/** A generated JPEG with a few words on it – for the probe, no file needed. */
export async function generatedImage(label: string, side = 512): Promise<string> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(side, side);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, side, side);
  ctx.fillStyle = "#000";
  ctx.font = `${Math.round(side / 8)}px sans-serif`;
  ctx.fillText(label, side / 10, side / 2);
  ctx.strokeRect(side / 20, side / 20, side * 0.9, side * 0.9);
  const jpeg = await canvas.encode("jpeg", 80);
  return `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}`;
}

/** First item: one text passage and one page image, each embedded, each returning a vector. */
export async function probe(model: string) {
  const image = await generatedImage("Flipper 42");
  const text = await embed(model, [
    { content: [{ type: "text", text: "Der linke Flipper klemmt beim Hochschalten." }] },
  ]);
  const picture = await embed(model, [{ content: [{ type: "image_url", image_url: { url: image } }] }]);
  return { model, text, image: picture, imageBytes: Math.round((image.length * 3) / 4) };
}

/** How many images the chat model takes in one request. */
export async function chatProbe(model: string, images: number) {
  const urls = await Promise.all(Array.from({ length: images }, (_, i) => generatedImage(`Bild ${i + 1}`, 256)));
  const started = performance.now();
  const response = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(180_000),
    headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      provider: PROVIDER,
      max_tokens: 20,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "How many images are attached? Answer with the number only." },
            ...urls.map((url) => ({ type: "image_url", image_url: { url } })),
          ],
        },
      ],
    }),
  });
  const text = await response.text();
  let answer: unknown = text.slice(0, 800);
  try {
    const body = JSON.parse(text) as {
      choices?: { message?: { content?: string } }[];
      usage?: unknown;
      provider?: string;
    };
    answer = { content: body.choices?.[0]?.message?.content, usage: body.usage, provider: body.provider, error: (body as { error?: unknown }).error };
  } catch {
    // keep the raw text
  }
  const endpoints = await fetch(`${BASE}/models/${model}/endpoints`)
    .then((r) => r.json())
    .catch(() => undefined);
  return { model, images, status: response.status, ms: Math.round(performance.now() - started), answer, endpoints };
}

export async function filesBySize() {
  const result = await database().execute(sql`
    select id, title, size, content_type, machine_id is not null as of_machine, machine_model_id is not null as of_model
    from file where removed_at is null and content_type = 'application/pdf' order by size desc limit 30`);
  return result.rows;
}

async function contentOf(fileId: string) {
  const result = await database().execute(
    sql`select content, size, title from file where id = ${fileId} and removed_at is null`,
  );
  const row = result.rows[0] as { content: string; size: number; title: string } | undefined;
  if (!row) throw new Error(`no file ${fileId}`);
  return row;
}

const RESULTS = "st-105-measure";

async function save(runId: string, value: unknown) {
  await s3Storage().write(
    `${RESULTS}/${runId}.json`,
    new TextEncoder().encode(JSON.stringify(value, null, 1)),
    "application/json",
  );
}

export async function readResult(runId: string) {
  const storage = s3Storage();
  const name = `${RESULTS}/${runId}.json`;
  const addresses = await storage.viewAddresses([name], new Date(Date.now() + 60_000));
  const response = await fetch(addresses.get(name)!);
  return response.ok ? response.json() : { status: response.status };
}

export function startRunId() {
  return randomUUID();
}

type PageItem = { page: number; kind: "image" | "text"; input: EmbedInput };

/** The whole measurement of one PDF. Writes progress every 20 pages and the final result to the store. */
export async function measure(runId: string, options: MeasureOptions) {
  const memory = memorySampler();
  const t0 = performance.now();
  const seconds = () => (performance.now() - t0) / 1000;
  const result: Record<string, unknown> = { runId, options, startedAt: new Date().toISOString(), state: "running" };
  const sum = { textMs: 0, renderMs: 0, encodeMs: 0, embedMs: 0, imageBytes: 0, imageWidth: 0, imageHeight: 0 };
  const tokens = { image: 0, text: 0, imageItems: 0, textItems: 0, cost: 0, imageCost: 0, textCost: 0 };
  const failures: unknown[] = [];
  let pagesDone = 0;
  let retries = 0;
  const providers = new Set<string>();
  const sizes = new Set<number>();
  try {
    const file = await contentOf(options.fileId);
    result.file = { title: file.title, sizeMb: Math.round(Number(file.size) / 1_048_576) };
    const r0 = performance.now();
    const storage = s3Storage();
    const address = (await storage.viewAddresses([file.content], new Date(Date.now() + 15 * 60_000))).get(
      file.content,
    )!;
    const bytes = new Uint8Array(await (await fetch(address)).arrayBuffer());
    result.readMs = Math.round(performance.now() - r0);

    const lib = await pdfjs();
    const o0 = performance.now();
    const loading = lib.getDocument({
      data: bytes,
      disableFontFace: true,
      useSystemFonts: false,
      standardFontDataUrl: path.join(pdfjsDir(), "standard_fonts") + path.sep,
      cMapUrl: path.join(pdfjsDir(), "cmaps") + path.sep,
      cMapPacked: true,
      // Scanned pages are mostly JBIG2 or JPEG 2000 – without the WASM decoders pdfjs renders them blank.
      wasmUrl: path.join(pdfjsDir(), "wasm") + path.sep,
      iccUrl: path.join(pdfjsDir(), "iccs") + path.sep,
    });
    const document = await loading.promise;
    result.openMs = Math.round(performance.now() - o0);
    result.pages = document.numPages;
    const last = Math.min(document.numPages, options.maxPages ?? document.numPages);

    // Embedding requests run beside the rendering, at most `concurrency` at a time, `batch` items of one kind each.
    const pending: PageItem[] = [];
    const inFlight = new Set<Promise<void>>();
    const send = (items: PageItem[]) => {
      const kind = items[0]!.kind;
      const promise = embed(
        options.model,
        items.map((i) => i.input),
      ).then((r) => {
        sum.embedMs += r.ms;
        retries += r.retries;
        if (r.provider) providers.add(r.provider);
        r.sizes.forEach((s) => sizes.add(s));
        if (!r.ok) failures.push({ pages: items.map((i) => i.page), kind, status: r.status, error: r.error });
        const t = r.usage?.prompt_tokens ?? 0;
        const c = r.usage?.cost ?? 0;
        tokens.cost += c;
        if (kind === "image") {
          tokens.image += t;
          tokens.imageItems += items.length;
          tokens.imageCost += c;
        } else {
          tokens.text += t;
          tokens.textItems += items.length;
          tokens.textCost += c;
        }
      });
      inFlight.add(promise);
      void promise.finally(() => inFlight.delete(promise));
    };
    const flush = async (all: boolean) => {
      for (const kind of ["image", "text"] as const) {
        for (;;) {
          const ofKind = pending.filter((p) => p.kind === kind);
          if (ofKind.length === 0 || (!all && ofKind.length < options.batch)) break;
          const items = ofKind.slice(0, options.batch);
          for (const item of items) pending.splice(pending.indexOf(item), 1);
          while (inFlight.size >= options.concurrency) await Promise.race(inFlight);
          send(items);
        }
      }
    };

    for (let number = 1; number <= last; number++) {
      if (seconds() > options.stopAfterSeconds) {
        result.stoppedAtPage = number - 1;
        break;
      }
      const page = await document.getPage(number);
      const a = performance.now();
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("")
        .trim();
      const b = performance.now();
      const base = page.getViewport({ scale: 1 });
      const scale = options.maxSide / Math.max(base.width, base.height);
      const viewport = page.getViewport({ scale });
      const factory = document.canvasFactory as {
        create(w: number, h: number): { canvas: { encode(f: string, q: number): Promise<Buffer> }; context: unknown };
        destroy(c: unknown): void;
      };
      const target = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({
        canvas: target.canvas as never,
        canvasContext: target.context as never,
        viewport,
      }).promise;
      const c = performance.now();
      const jpeg = await target.canvas.encode("jpeg", options.quality);
      const d = performance.now();
      factory.destroy(target);
      page.cleanup();
      sum.textMs += b - a;
      sum.renderMs += c - b;
      sum.encodeMs += d - c;
      sum.imageBytes += jpeg.length;
      sum.imageWidth = Math.ceil(viewport.width);
      sum.imageHeight = Math.ceil(viewport.height);
      if (options.embed) {
        pending.push({
          page: number,
          kind: "image",
          input: {
            content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } }],
          },
        });
        if (text.length > 0) pending.push({ page: number, kind: "text", input: { content: [{ type: "text", text }] } });
        await flush(false);
      }
      pagesDone = number;
      if (number % 20 === 0) {
        result.progress = { pagesDone, seconds: Math.round(seconds()), memory: process.memoryUsage().rss / 1_048_576 };
        await save(runId, { ...result, sum, tokens, failures: failures.slice(0, 5) });
      }
    }
    if (options.embed) {
      await flush(true);
      await Promise.all(inFlight);
    }
    await loading.destroy();
    result.state = "done";
  } catch (error) {
    result.state = "failed";
    result.error = error instanceof Error ? `${error.message}\n${error.stack?.slice(0, 800)}` : String(error);
  }
  const total = seconds();
  const per = (n: number) => (pagesDone ? Math.round(n / pagesDone) : null);
  Object.assign(result, {
    pagesDone,
    totalSeconds: Math.round(total),
    secondsPerPage: pagesDone ? Number((total / pagesDone).toFixed(3)) : null,
    perPageMs: {
      text: per(sum.textMs),
      render: per(sum.renderMs),
      encode: per(sum.encodeMs),
      embedRequestSum: per(sum.embedMs),
    },
    image: { width: sum.imageWidth, height: sum.imageHeight, averageKb: per(sum.imageBytes / 1024) },
    tokens: {
      ...tokens,
      perImage: tokens.imageItems ? Math.round(tokens.image / tokens.imageItems) : null,
      perText: tokens.textItems ? Math.round(tokens.text / tokens.textItems) : null,
      costPerPage: pagesDone ? tokens.cost / pagesDone : null,
    },
    retries,
    providers: [...providers],
    embeddingSizes: [...sizes],
    failureCount: failures.length,
    failures: failures.slice(0, 10),
    memory: memory.stop(),
    node: process.version,
    memoryLimitMb: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE ?? null,
    region: process.env.VERCEL_REGION ?? null,
  });
  await save(runId, result);
  console.log(`ST-105 ${JSON.stringify({ runId, state: result.state, pagesDone, totalSeconds: result.totalSeconds })}`);
  return result;
}
