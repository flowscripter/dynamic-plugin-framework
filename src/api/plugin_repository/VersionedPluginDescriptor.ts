import type PluginDescriptor from "./PluginDescriptor.ts";
import type PluginDependency from "../plugin/PluginDependency.ts";

/**
 * Extends {@link PluginDescriptor} with versioning metadata sourced from a backing store
 * (e.g. a manifest file, package.json, or registry API) without loading the plugin module.
 */
export default interface VersionedPluginDescriptor extends PluginDescriptor {
  /**
   * Optional npm-style scope (e.g. `flowscripter` for `@flowscripter/my-plugin`).
   */
  readonly scope?: string;

  /**
   * Plugin name, without scope prefix.
   */
  readonly name: string;

  /**
   * Semver version string (e.g. `1.2.3`).
   */
  readonly version: string;

  /**
   * Optional list of other plugins that this plugin depends on.
   */
  readonly dependencies?: ReadonlyArray<PluginDependency>;
}
