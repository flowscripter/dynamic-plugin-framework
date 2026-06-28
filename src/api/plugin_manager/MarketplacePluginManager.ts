import type PluginManager from "./PluginManager.ts";
import type SearchQuery from "../plugin_repository/SearchQuery.ts";
import type VersionedPluginDescriptor from "../plugin_repository/VersionedPluginDescriptor.ts";
import type VersionedPluginRepository from "../plugin_repository/VersionedPluginRepository.ts";

/**
 * Extends {@link PluginManager} with marketplace-level search, install, uninstall, and update
 * checking capabilities.
 *
 * A `MarketplacePluginManager` combines one or more remote {@link MarketplacePluginRepository}
 * instances (for discovery) with a local {@link VersionedPluginRepository} (for loading and
 * installation). The standard {@link PluginManager} methods delegate to an internal
 * {@link DefaultPluginManager} backed by the local repository.
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

  /**
   * Remove a plugin from the local repository.
   *
   * Throws if another installed plugin declares a dependency on the plugin being removed.
   *
   * @param pluginId the ID of the plugin to remove.
   */
  uninstall(pluginId: string): Promise<void>;

  /**
   * List all plugins currently installed in the local repository.
   *
   * @return an async iterable of {@link VersionedPluginDescriptor} instances for all locally installed plugins.
   */
  listInstalled(): AsyncIterable<Readonly<VersionedPluginDescriptor>>;

  /**
   * Compare the local repository against a remote repository and yield entries where a newer
   * version is available remotely.
   *
   * @param remote the remote {@link VersionedPluginRepository} to compare against. Defaults to
   *   the first configured remote.
   *
   * @return an async iterable of objects pairing the remote {@link VersionedPluginDescriptor}
   *   with the available version string.
   */
  checkForUpdates(
    remote?: VersionedPluginRepository,
  ): AsyncIterable<{ descriptor: Readonly<VersionedPluginDescriptor>; availableVersion: string }>;
}
