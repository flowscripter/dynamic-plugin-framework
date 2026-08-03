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
   * Check whether a plugin (and, optionally, a specific version of it) is available from any of
   * the configured remote marketplace repositories, via a direct targeted lookup - not the
   * fuzzy/ranked {@link search}.
   *
   * Each remote is checked in order via its {@link MarketplacePluginRepository.getPlugin}, which
   * performs a targeted lookup rather than scanning all plugins. Returns `true` as soon as any
   * remote has a match.
   *
   * Note: a `MarketplacePluginRepository` exposes a single "current" {@link VersionedPluginDescriptor}
   * per plugin ID (typically the latest published version), not a full version history. When
   * `version` is given, this checks whether that current version matches - it does not confirm
   * whether an older version was ever published.
   *
   * @param pluginId the plugin ID to check for (as returned by {@link VersionedPluginDescriptor.pluginId}).
   * @param version optional exact version to additionally check for.
   *
   * @return `true` if the plugin (and version, if given) is found in at least one configured remote,
   * `false` otherwise.
   */
  checkAvailable(pluginId: string, version?: string): Promise<boolean>;

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
