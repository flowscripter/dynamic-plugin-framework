import type VersionedPluginRepository from "./VersionedPluginRepository.ts";
import type VersionedPluginDescriptor from "./VersionedPluginDescriptor.ts";
import type SearchQuery from "./SearchQuery.ts";

/**
 * A {@link VersionedPluginRepository} that additionally exposes search capability and marketplace metadata.
 *
 * Intended for remote plugin marketplaces such as npmjs.com (or compatible registries) or
 * HTTP-hosted manifest files. Implementations define which fields of {@link SearchQuery} they support.
 */
export default interface MarketplacePluginRepository extends VersionedPluginRepository {
  /**
   * Human-readable name of this marketplace.
   */
  readonly name: string;

  /**
   * Optional description of this marketplace.
   */
  readonly description?: string;

  /**
   * Optional author or organisation responsible for this marketplace.
   */
  readonly author?: string;

  /**
   * URL of this marketplace (e.g. the registry base URL or manifest URL).
   */
  readonly url: string;

  /**
   * Search for plugins in this marketplace matching the given query.
   *
   * The fields searched are provider-defined. Implementations may accept an extended
   * {@link SearchQuery} subtype to support additional filter criteria.
   *
   * @param query the search criteria.
   *
   * @return an async iterable of matching {@link VersionedPluginDescriptor} instances.
   */
  search(query: Readonly<SearchQuery>): AsyncIterable<Readonly<VersionedPluginDescriptor>>;
}
