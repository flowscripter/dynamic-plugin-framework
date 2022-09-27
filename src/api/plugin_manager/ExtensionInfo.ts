/**
 * Provides information for a particular Extension which has been registered with a {@link PluginManager}.
 */
export default interface ExtensionInfo {
  /**
   * Handle provided by a {@link PluginManager} to reference an Extension
   */
  readonly extensionHandle: string;

  /**
   * Optional data provided by the {@link ExtensionDescriptor} associated with the Extension
   */
  readonly extensionData?: ReadonlyMap<string, string>;

  /**
   * Optional data provided by the {@link Plugin} providing the Extension
   */
  readonly pluginData?: ReadonlyMap<string, string>;
}
