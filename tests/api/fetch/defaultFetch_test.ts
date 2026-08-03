import { afterEach, describe, expect, it, mock } from "bun:test";
import defaultFetch, { DEFAULT_FETCH_TIMEOUT_MS } from "../../../src/api/fetch/defaultFetch.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Simulates native fetch()'s real behaviour: the returned promise only settles once the
// supplied AbortSignal fires, otherwise it hangs forever - exactly the pattern that causes the
// indefinite hang this fix addresses.
function mockHangingFetch() {
  return mock((_input: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    });
  });
}

describe("defaultFetch", () => {
  it("exposes a sensible default timeout", () => {
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("aborts and rejects once the custom timeoutMs elapses, instead of hanging", async () => {
    const fetchMock = mockHangingFetch();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(defaultFetch("https://example.com/pkg", { timeoutMs: 25 })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes an abort signal through to native fetch even without an explicit timeoutMs", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchMock = mock((_input: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await defaultFetch("https://example.com/pkg");

    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);
  });

  it("combines a caller-supplied signal with the timeout signal", async () => {
    const fetchMock = mockHangingFetch();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const callerController = new AbortController();
    const promise = defaultFetch("https://example.com/pkg", {
      signal: callerController.signal,
      timeoutMs: 60_000,
    });
    callerController.abort();

    await expect(promise).rejects.toThrow();
  });
});
