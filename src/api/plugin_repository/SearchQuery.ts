/**
 * Base query type for {@link MarketplacePluginRepository.search}.
 *
 * Implementations of {@link MarketplacePluginRepository} may extend this interface to expose
 * additional provider-specific filter fields (e.g. npm keywords, tag values).
 */
export default interface SearchQuery {
  /**
   * Free-text search string. The fields searched are provider-defined
   * (e.g. name, description and keywords on npmjs.com).
   */
  readonly text?: string;
}
