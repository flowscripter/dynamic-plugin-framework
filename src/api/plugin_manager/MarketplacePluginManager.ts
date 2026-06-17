import type PluginManager from "./PluginManager.ts";
import type SearchQuery from "../plugin_repository/SearchQuery.ts";
import type VersionedPluginDescriptor from "../plugin_repository/VersionedPluginDescriptor.ts";

/**
 * Extends {@link PluginManager} with marketplace-level search and install capabilities.
 *
 * A `MarketplacePluginManager` combines one or more remote {@link MarketplacePluginRepository}
 * instances (for discovery) with a local {@link VersionedPluginRepository} (for loading) and a
 * {@link VersionedPluginInstaller} (for installation). The standard {@link PluginManager} methods
 * delegate to an internal {@link DefaultPluginManager} backed by the local repository.
 */
export default interface MarketplacePluginManager extends PluginManager {
  /**
   * Search for plugins across all configured remote marketplace repositories.
   *
   * @param query the search criteria, passed to each remote repository in order.
   *
   * @return an async iterable of matching {@link VersionedPluginDescriptor} instances from all remotes.
   */
  search(query: Readonly<SearchQuery>): AsyncIterable<Readonly<VersionedPluginDescriptor>>;

  /**
   * Install a plugin (and optionally its dependencies) from the remote marketplace into the local repository.
   *
   * @param descriptor the {@link VersionedPluginDescriptor} identifying the plugin to install.
   * @param options.includeDependencies if `true`, recursively install missing dependencies.
   */
  install(
    descriptor: Readonly<VersionedPluginDescriptor>,
    options?: { includeDependencies?: boolean },
  ): Promise<void>;
}
