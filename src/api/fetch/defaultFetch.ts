import type FetchInterface from "./FetchInterface.ts";

/**
 * Default timeout applied to a fetch when the caller does not specify `timeoutMs`.
 *
 * A registry/manifest lookup is expected to be a small JSON round-trip, so it should fail fast
 * rather than hang indefinitely on a stalled connection (dead peer, firewall silently dropping
 * packets, etc.) - 10s gives slow networks a reasonable chance to succeed without leaving a
 * caller (e.g. a synchronous pre-install `checkAvailable()` check) blocked for an unbounded time.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

/**
 * Default {@link FetchInterface.fetch} implementation used by repositories when no host-supplied
 * {@link FetchInterface} has been set via {@link FetchCapable.setFetch}.
 *
 * Delegates to native `fetch()`, but always applies a timeout: `init.timeoutMs` if given,
 * otherwise {@link DEFAULT_FETCH_TIMEOUT_MS}. If the caller also supplies `init.signal`, aborting
 * either the caller's signal or the timeout aborts the request.
 *
 * Implemented with a manual `setTimeout()` + `AbortController` (rather than `AbortSignal.timeout()`
 * / `AbortSignal.any()`) for maximum cross-platform portability, and the timer is always cleared
 * once the fetch settles so no dangling timer can keep the process/event-loop alive.
 */
const defaultFetch: FetchInterface["fetch"] = async (input, init) => {
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort(init?.signal?.reason);
  if (init?.signal?.aborted) {
    onCallerAbort();
  } else {
    init?.signal?.addEventListener("abort", onCallerAbort);
  }

  const timer = setTimeout(() => {
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
  }, init?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener("abort", onCallerAbort);
  }
};

export default defaultFetch;
