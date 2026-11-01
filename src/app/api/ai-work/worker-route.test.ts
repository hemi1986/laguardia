import { afterEach, describe, expect, it, vi } from "vitest";
import { startAiWork } from "./start-ai-work";
import { workerRoute } from "./worker-route";

/**
 * The worker route of the AI work (ST-112, ADR 0015) – the one route that starts paid work. Real requests; the run is
 * injected, so a test sees whether it was started and never waits for one. The start function is tested through the
 * route: its `fetch` hands the request to the route, as the deployment would.
 */
const SECRET = "a-worker-secret-of-at-least-32-characters";

function aRoute(secret: string | undefined = SECRET) {
  const runs: string[] = [];
  const pending: (() => Promise<void>)[] = [];
  const handle = workerRoute({
    secret: () => secret,
    run: async () => {
      runs.push("run");
    },
    afterResponse: (work) => {
      pending.push(work);
    },
  });
  return {
    handle,
    runs,
    /** Runs what the route left for after its response, as Next.js `after()` does. */
    afterTheResponse: () => Promise.all(pending.splice(0).map((work) => work())),
  };
}

const call = (authorization?: string, url = "https://laguardia.example/api/ai-work") =>
  new Request(url, { method: "POST", headers: authorization ? { authorization } : {} });

afterEach(() => vi.restoreAllMocks());

describe("the worker route", () => {
  it("answers at once and starts a run after its response for a request carrying the deployment's worker secret", async () => {
    const route = aRoute();

    const response = await route.handle(call(`Bearer ${SECRET}`));

    expect(response.status).toBe(202);
    expect(route.runs).toEqual([]);
    await route.afterTheResponse();
    expect(route.runs).toEqual(["run"]);
  });

  it.each([
    ["without a secret", undefined],
    ["with a wrong secret", "Bearer a-wrong-secret-of-at-least-32-characters!"],
    ["with the secret not as a bearer", SECRET],
    ["with the secret and more", `Bearer ${SECRET}x`],
    ["with an empty bearer", "Bearer "],
  ])("refuses a request %s and starts nothing", async (_, authorization) => {
    const route = aRoute();

    const response = await route.handle(call(authorization));

    expect(response.status).toBe(401);
    await route.afterTheResponse();
    expect(route.runs).toEqual([]);
  });

  it.each([
    ["has no worker secret", undefined],
    ["has an empty worker secret", ""],
    ["has a worker secret too short to be one", "short"],
  ])("refuses every request when the deployment %s", async (_, secret) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const route = aRoute(secret);

    const response = await route.handle(call(`Bearer ${secret ?? ""}`));

    expect(response.status).toBe(401);
    await route.afterTheResponse();
    expect(route.runs).toEqual([]);
  });
});

describe("starting the AI work", () => {
  function routedTo(route: ReturnType<typeof aRoute>) {
    const requests: Request[] = [];
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request.clone());
      return route.handle(request);
    };
    return { fetch, requests };
  }

  it("calls the worker route with the secret from the server's environment, and the route starts a run", async () => {
    const route = aRoute();
    const { fetch, requests } = routedTo(route);

    await startAiWork({ env: { AI_WORK_SECRET: SECRET }, fetch });

    expect(requests.map((request) => [request.method, request.url])).toEqual([
      ["POST", "http://localhost:3000/api/ai-work"],
    ]);
    await route.afterTheResponse();
    expect(route.runs).toEqual(["run"]);
  });

  it.each([
    ["production: the production domain", { VERCEL_ENV: "production" }, "https://laguardia.example/api/ai-work"],
    ["a preview: its own deployment", { VERCEL_ENV: "preview" }, "https://preview-abc123.laguardia.example/api/ai-work"],
    [
      "a server of its own: the address it is given",
      { AI_WORK_ORIGIN: "https://werkstatt.example" },
      "https://werkstatt.example/api/ai-work",
    ],
  ])("calls the deployment itself, never an address from a request – %s", async (_, env, url) => {
    const { fetch, requests } = routedTo(aRoute());

    await startAiWork({
      env: {
        AI_WORK_SECRET: SECRET,
        VERCEL_URL: "preview-abc123.laguardia.example",
        VERCEL_PROJECT_PRODUCTION_URL: "laguardia.example",
        ...env,
      },
      fetch,
    });

    expect(requests.map((request) => request.url)).toEqual([url]);
  });

  it("sends nothing when the server has no worker secret – the chain waits for the next start", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { fetch, requests } = routedTo(aRoute());

    await startAiWork({ env: {}, fetch });

    expect(requests).toEqual([]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("AI_WORK_SECRET"));
  });

  it("never throws when the worker route cannot be reached or refuses – it logs that the chain stopped", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await startAiWork({
      env: { AI_WORK_SECRET: SECRET },
      fetch: () => Promise.reject(new TypeError("fetch failed")),
    });
    await startAiWork({
      env: { AI_WORK_SECRET: SECRET },
      fetch: routedTo(aRoute("another-secret-of-at-least-32-chars")).fetch,
    });

    expect(error).toHaveBeenCalledTimes(2);
  });
});
