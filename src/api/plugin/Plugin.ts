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

  /**
   * Optional modules the plugin expects the host to supply (see `registerSharedModules`),
   * as a map of module specifier to semver range of the supported version.
   * The plugin is rejected if the host has not declared a listed module or its version does not satisfy the range.
   */
  readonly sharedModules?: Readonly<Record<string, string>>;
}
