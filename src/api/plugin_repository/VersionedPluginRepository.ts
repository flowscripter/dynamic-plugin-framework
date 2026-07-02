import type PluginRepository from "./PluginRepository.ts";
import type VersionedPluginDescriptor from "./VersionedPluginDescriptor.ts";

/**
 * A {@link PluginRepository} that exposes versioning metadata for its plugins via a backing store
 * (e.g. a manifest file or package.json) without requiring each plugin module to be loaded.
 *
 * Narrows the return type of {@link PluginRepository.getPlugins} to {@link VersionedPluginDescriptor}.
 */
export default interface VersionedPluginRepository extends PluginRepository {
  /**
   * Return a {@link VersionedPluginDescriptor} for each Plugin hosted in this repository,
   * sourcing version and dependency metadata from the backing store.
   *
   * @return an async iterable of {@link VersionedPluginDescriptor} instances.
   */
  getPlugins(): AsyncIterable<Readonly<VersionedPluginDescriptor>>;

  /**
   * Return a {@link VersionedPluginDescriptor} for a single named plugin, sourcing version and
   * dependency metadata from the backing store without loading the plugin module. Implementations
   * should perform a targeted lookup rather than scanning the full result of {@link getPlugins}.
   *
   * @param pluginId the plugin ID to look up (as returned by {@link VersionedPluginDescriptor.pluginId}).
   *
   * @return the matching {@link VersionedPluginDescriptor}, or `undefined` if not found.
   */
  getPlugin(pluginId: string): Promise<Readonly<VersionedPluginDescriptor> | undefined>;
}
