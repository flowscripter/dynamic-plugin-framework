import type FetchInterface from "./FetchInterface.ts";

/**
 * Implemented by {@link PluginManager} and {@link MarketplacePluginRepository} implementations
 * which support having their `fetch()` calls delegated to a host-supplied {@link FetchInterface}
 * instead of fetching directly.
 */
export default interface FetchCapable {
  /**
   * Supply the {@link FetchInterface} to delegate fetch calls to.
   */
  setFetch(fetch: FetchInterface): void;
}
