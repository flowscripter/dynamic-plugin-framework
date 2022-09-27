/**
 * Provides information for a particular Extension which is provided by a plugin hosted in a {@link PluginRepository}.
 */
export default interface ExtensionEntry {
  /**
   * ID provided by a {@link PluginRepository} to reference a a Plugin.
   *
   * Note that this is only unique per {@link PluginRepository}.
   */
  readonly pluginId: string;

  /**
   * ID provided by a {@link PluginRepository} to reference an Extension provided by a Plugin.
   *
   * Note that this is only unique per Plugin.
   */
  readonly extensionId: string;

  /**
   * The implemented Extension Point
   */
  readonly extensionPoint: string;

  /**
   * Optional data provided by the Plugin providing the Extension to the host application
   */
  readonly pluginData?: ReadonlyMap<string, string>;

  /**
   * Optional data provided by the Extension to the host application
   */
  readonly extensionData?: ReadonlyMap<string, string>;
}
