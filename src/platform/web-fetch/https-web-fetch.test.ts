import { describe, expect, it } from "vitest";
import { AddressRefused, webFetcher, type HopAnswer, type Transport } from "./https-web-fetch";

/** ST-129: the real adapter's rules with a transport that plays the web – hops, redirects, limits. */
function answer(overrides: Partial<HopAnswer> & { chunks?: Uint8Array[] } = {}): HopAnswer {
  const { chunks = [new Uint8Array([37, 80, 68, 70])], ...rest } = overrides;
  return {
    status: 200,
    contentType: "application/pdf",
    body: (async function* () {
      yield* chunks;
    })(),
    close: () => undefined,
    ...rest,
  };
}

function web(answers: Record<string, () => HopAnswer>, ownHosts: string[] = []) {
  const asked: string[] = [];
  const transport: Transport = async (url) => {
    asked.push(url.href);
    const make = answers[url.href];
    if (!make) throw new Error("no connection");
    return make();
  };
  return { fetcher: webFetcher({ transport, ownHosts }), asked };
}

const limit = { maxBytes: 100 };

describe("the web fetch adapter", () => {
  it("returns the bytes and the media type", async () => {
    const { fetcher } = web({ "https://example.org/a.pdf": () => answer() });
    expect(await fetcher.fetch("https://example.org/a.pdf", limit)).toEqual({
      ok: true,
      contentType: "application/pdf",
      bytes: new Uint8Array([37, 80, 68, 70]),
    });
  });

  it("asks nothing for an address that is not allowed", async () => {
    const { fetcher, asked } = web({});
    expect(await fetcher.fetch("http://192.168.0.5/manual.pdf", limit)).toEqual({
      ok: false,
      reason: "address-not-allowed",
    });
    expect(asked).toEqual([]);
  });

  it("follows a redirect, also a relative one, and checks every hop", async () => {
    const { fetcher, asked } = web({
      "https://example.org/a": () => answer({ status: 302, location: "/b" }),
      "https://example.org/b": () => answer(),
    });
    expect((await fetcher.fetch("https://example.org/a", limit)).ok).toBe(true);
    expect(asked).toEqual(["https://example.org/a", "https://example.org/b"]);
  });

  it.each(["http://example.org/b", "https://10.0.0.1/b", "https://museum.example/b"])(
    "stops a redirect to %s",
    async (target) => {
      const { fetcher, asked } = web(
        { "https://example.org/a": () => answer({ status: 301, location: target }) },
        ["museum.example"],
      );
      expect(await fetcher.fetch("https://example.org/a", limit)).toEqual({ ok: false, reason: "address-not-allowed" });
      expect(asked).toEqual(["https://example.org/a"]);
    },
  );

  it("gives up on a chain of redirects that does not end", async () => {
    const { fetcher } = web({ "https://example.org/a": () => answer({ status: 302, location: "/a" }) });
    expect(await fetcher.fetch("https://example.org/a", limit)).toEqual({ ok: false, reason: "not-reachable" });
  });

  it("refuses a name that resolves to a private address", async () => {
    const fetcher = webFetcher({
      transport: async () => {
        throw new AddressRefused("private address");
      },
    });
    expect(await fetcher.fetch("https://sneaky.example/a.pdf", limit)).toEqual({
      ok: false,
      reason: "address-not-allowed",
    });
  });

  it("fails a content that is too large by its declared length or while reading", async () => {
    const { fetcher } = web({
      "https://example.org/declared": () => answer({ contentLength: 101 }),
      "https://example.org/read": () => answer({ chunks: [new Uint8Array(60), new Uint8Array(60)] }),
    });
    expect(await fetcher.fetch("https://example.org/declared", limit)).toEqual({ ok: false, reason: "too-large" });
    expect(await fetcher.fetch("https://example.org/read", limit)).toEqual({ ok: false, reason: "too-large" });
  });

  it("is not reachable for a connection that fails, a status that is not 200 and a body that breaks off", async () => {
    const { fetcher } = web({
      "https://example.org/missing": () => answer({ status: 404 }),
      "https://example.org/broken": () =>
        answer({
          body: (async function* () {
            yield new Uint8Array(1);
            throw new Error("reset");
          })(),
        }),
    });
    expect(await fetcher.fetch("https://example.org/missing", limit)).toEqual({ ok: false, reason: "not-reachable" });
    expect(await fetcher.fetch("https://example.org/broken", limit)).toEqual({ ok: false, reason: "not-reachable" });
    expect(await fetcher.fetch("https://example.org/nobody", limit)).toEqual({ ok: false, reason: "not-reachable" });
  });
});
