/**
 * Allows a host application to supply its own `fetch()` implementation (e.g. one which
 * integrates with a CLI framework's shutdown handling and timeout support) instead of a
 * repository or plugin manager calling `fetch()` directly.
 */
export default interface FetchInterface {
  /**
   * Perform a fetch request.
   *
   * @param input the URL to fetch.
   * @param init standard `RequestInit` fields plus an optional `timeoutMs`.
   *
   * @return the `Response`. Rejects the same way native `fetch()` does.
   */
  fetch(input: string, init?: RequestInit & { timeoutMs?: number }): Promise<Response>;
}
