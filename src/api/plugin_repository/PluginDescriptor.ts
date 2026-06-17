/**
 * Lightweight metadata about a Plugin hosted in a {@link PluginRepository}, returned by
 * {@link PluginRepository.getPlugins} without requiring the plugin module to be loaded.
 */
export default interface PluginDescriptor {
  /**
   * ID provided by a {@link PluginRepository} to reference the Plugin. Unique within the repository.
   */
  readonly pluginId: string;

  /**
   * Optional data provided by the Plugin to the host application.
   */
  readonly pluginData?: ReadonlyMap<string, string>;

  /**
   * The Extension Point identifiers implemented by this Plugin.
   * Allows {@link PluginRepository.scanForExtensions} to filter without loading each plugin module.
   */
  readonly extensionPoints: string[];
}
