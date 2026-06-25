/**
 * Declares a dependency on another {@link VersionedPlugin} by name and semver version range.
 */
export default interface PluginDependency {
  /**
   * Optional npm-style scope of the depended-on plugin (e.g. `flowscripter` for `@flowscripter/my-plugin`).
   */
  readonly scope?: string;

  /**
   * Name of the depended-on plugin, without scope prefix.
   */
  readonly name: string;

  /**
   * Semver version range that must be satisfied by the installed version of the depended-on plugin
   * (e.g. `^1.2.0`, `>=2.0.0`).
   */
  readonly versionRange: string;
}
