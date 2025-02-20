import type ExtensionEntry from "../plugin_repository/ExtensionEntry.ts";

/**
 * A registry of Extensions.
 */
export default interface ExtensionRegistry {
  /**
   * Register a specified {@link ExtensionEntry} with a specified Extension handle.
   *
   * @param extensionHandle a unique identifier under which to register the {@link ExtensionEntry}
   * @param extensionEntry the {@link ExtensionEntry} for the Extension to register
   */
  register(
    extensionHandle: string,
    extensionEntry: ExtensionEntry,
  ): Promise<void>;

  /**
   * Return the specified registered {@link ExtensionEntry} instance.
   *
   * @param extensionHandle the handle for the desired {@link ExtensionEntry} instance
   *
   * @return an {@link ExtensionEntry} instance
   */
  get(extensionHandle: string): Promise<Readonly<ExtensionEntry>>;

  /**
   * Return {@link ExtensionEntry} instances for registered Extensions implementing the specified Extension Point.
   *
   * @param extensionPoint the Extension Point to match
   *
   * @return a map of extension handle to {@link ExtensionEntry} for all matching
   * registered {@link ExtensionEntry} instances
   */
  getExtensions(
    extensionPoint: string,
  ): Promise<ReadonlyMap<string, ExtensionEntry>>;
}
