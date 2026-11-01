import { timingSafeEqual } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { chatProbe, filesBySize, measure, probe, readResult, startRunId } from "./measure";

/** ST-105 spike – THROW-AWAY measuring route, never merged. Only off production, only with the spike's token. */
export const maxDuration = 800;
export const dynamic = "force-dynamic";

function allowed(request: NextRequest): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  const expected = process.env.ST105_MEASURE_TOKEN;
  const given = request.nextUrl.searchParams.get("token") ?? "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!allowed(request)) return new Response("Not Found", { status: 404 });
  const q = request.nextUrl.searchParams;
  const model = q.get("model") ?? "google/gemini-embedding-2";
  switch (q.get("action")) {
    case "env":
      return Response.json({
        keyPresent: Boolean(process.env.ST105_OPENROUTER_KEY),
        vercelEnv: process.env.VERCEL_ENV ?? null,
        region: process.env.VERCEL_REGION ?? null,
        memoryLimitMb: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE ?? null,
        node: process.version,
      });
    case "files":
      return Response.json(await filesBySize());
    case "probe":
      return Response.json(await probe(model));
    case "chat":
      return Response.json(await chatProbe(q.get("model") ?? "google/gemini-2.5-flash", Number(q.get("images") ?? 27)));
    case "result":
      return Response.json(await readResult(q.get("run") ?? ""));
    case "measure": {
      const runId = startRunId();
      const options = {
        fileId: q.get("file") ?? "",
        model,
        maxSide: Number(q.get("maxSide") ?? 1024),
        quality: Number(q.get("quality") ?? 75),
        batch: Number(q.get("batch") ?? 1),
        concurrency: Number(q.get("concurrency") ?? 4),
        maxPages: q.get("maxPages") ? Number(q.get("maxPages")) : undefined,
        embed: q.get("embed") !== "0",
        stopAfterSeconds: Number(q.get("stopAfter") ?? 700),
      };
      after(() => measure(runId, options));
      return Response.json({ runId, options });
    }
    default:
      return new Response("action?", { status: 400 });
  }
}
