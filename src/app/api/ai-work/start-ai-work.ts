import "server-only";

/** What starting the AI work reads from the server's environment – never anything from a request. */
export type WorkerEnvironment = {
  AI_WORK_SECRET?: string;
  /** A server of its own (Docker): the address it answers on, e.g. `https://werkstatt.example`. */
  AI_WORK_ORIGIN?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  PORT?: string;
  /** `process.env` itself – only the names above are read. */
  [name: string]: string | undefined;
};

export type StartAiWorkDependencies = {
  env: WorkerEnvironment;
  fetch: (input: string, init: RequestInit) => Promise<Response>;
};

/** The worker route answers at once; a call that takes longer has failed. */
const CALL_TIMEOUT_MS = 10_000;

/**
 * Starts the AI work (ST-112, ADR 0015): calls the worker route of this deployment with the worker secret from the
 * server's environment, so the secret never reaches a page, a link or the browser. Called after a response – by a
 * Server Action once its command has committed, by a page that sees work left unfinished, and by a run that leaves
 * work for the next one. Never throws: when the call fails, the chain of runs stops and what is left waits for the
 * next start (docs/operations/ai-work.md).
 */
export async function startAiWork({ env, fetch }: StartAiWorkDependencies): Promise<void> {
  const secret = env.AI_WORK_SECRET;
  if (!secret) {
    console.error("AI work: AI_WORK_SECRET is not set – no run is started (docs/operations/ai-work.md)");
    return;
  }
  try {
    const response = await fetch(`${workerOrigin(env)}/api/ai-work`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      // A redirect would send the bearer request on to another address – it fails instead.
      redirect: "error",
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    if (response.status !== 202) console.error(`AI work: the worker route answered ${response.status} – no run`);
  } catch (error) {
    console.error("AI work: the worker route could not be called:", error instanceof Error ? error.message : "unknown");
  }
}

/**
 * Where this deployment answers – from its own environment, never from a request's Host, which a caller could set to
 * an address of theirs and receive the secret. Production: its production domain (the generated deployment address
 * is behind Vercel's protection); a preview: its own deployment; a server of its own: `AI_WORK_ORIGIN`; locally the
 * dev server.
 */
function workerOrigin(env: WorkerEnvironment): string {
  if (env.AI_WORK_ORIGIN) return env.AI_WORK_ORIGIN.replace(/\/+$/, "");
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return `http://localhost:${env.PORT ?? "3000"}`;
}
