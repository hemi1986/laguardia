import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export type WorkerRouteDependencies = {
  /** The deployment's worker secret (`AI_WORK_SECRET`) – read per request, never sent anywhere. */
  secret: () => string | undefined;
  /** One run of the AI work. */
  run: () => Promise<void>;
  /** Runs work after the response is sent (Next.js `after()`). */
  afterResponse: (work: () => Promise<void>) => void;
};

/** Shorter than this, a configured secret is a mistake, not a secret – the route then refuses everything. */
export const WORKER_SECRET_MINIMUM_LENGTH = 32;

/**
 * The worker route `/api/ai-work` (ST-112, ADR 0015): the one place a run of the AI work starts. It accepts only a
 * request carrying the deployment's worker secret as a bearer token – from the start function on the server, never
 * from a page or a browser –, answers at once with 202 and does the run in its own `after()`. A request without the
 * secret, with a wrong one, or to a deployment without one is refused with 401 and starts nothing.
 * Not behind the page proxy (`/api/`); no session and no Origin: the secret is its only key.
 */
export function workerRoute(dependencies: WorkerRouteDependencies) {
  return async function POST(request: Request): Promise<Response> {
    const secret = dependencies.secret();
    if (!secret || secret.length < WORKER_SECRET_MINIMUM_LENGTH) {
      console.error("AI work: AI_WORK_SECRET is not set (or too short) – the worker route refuses every request");
      return unauthorized();
    }
    if (!carries(request, secret)) return unauthorized();
    dependencies.afterResponse(async () => {
      try {
        await dependencies.run();
      } catch (error) {
        console.error("AI work: the run failed:", error instanceof Error ? error.name : error);
      }
    });
    return new Response(null, { status: 202 });
  };
}

const unauthorized = () => new Response("Unauthorized", { status: 401 });

/** Compared as digests in constant time, so neither the length nor a prefix of the secret leaks through timing. */
function carries(request: Request, secret: string): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  const sent = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  return sent.length > 0 && timingSafeEqual(digest(sent), digest(secret));
}

const digest = (value: string) => createHash("sha256").update(value).digest();
