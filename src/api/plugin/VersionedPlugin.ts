import type Plugin from "./Plugin.ts";
import type PluginDependency from "./PluginDependency.ts";

/**
 * Extends {@link Plugin} with versioning metadata: scope, name, semver version and optional
 * {@link PluginDependency} declarations.
 *
 * {@link VersionedPluginRepository} implementations can expose this metadata from a backing store
 * (e.g. a manifest file or package.json) without loading the plugin module.
 */
export default interface VersionedPlugin extends Plugin {
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
