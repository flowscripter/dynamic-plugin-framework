import type ExtensionDescriptor from "./ExtensionDescriptor.ts";

/**
 * Interface for a Plugin implementation.
 */
export default interface Plugin {
  /**
   * Array of {@link ExtensionDescriptor} instances describing all Extensions provided by the plugin.
   */
  readonly extensionDescriptors: ReadonlyArray<ExtensionDescriptor>;

  /**
   * Optional data provided by the Plugin to the host application
   */
  readonly pluginData?: ReadonlyMap<string, string>;
}
