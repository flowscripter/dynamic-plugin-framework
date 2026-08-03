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
 * otherwise {@link DEFAULT_FETCH_TIMEOUT_MS}. If the caller also supplies `init.signal`, both
 * signals are combined via `AbortSignal.any()` so that either aborting the caller's signal or
 * hitting the timeout aborts the request.
 */
const defaultFetch: FetchInterface["fetch"] = (input, init) => {
  const timeoutSignal = AbortSignal.timeout(init?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  return fetch(input, { ...init, signal });
};

export default defaultFetch;
