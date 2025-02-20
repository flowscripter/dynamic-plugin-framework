import type ExtensionInfo from "./ExtensionInfo.ts";

/**
 * Used by a host application to manage discovery of Extensions provided by {@link Plugin} implementations.
 */
export default interface PluginManager {
  /**
   * Scan for Plugins and register their Extensions which implement the specified Extension Point.
   *
   * @param extensionPoint the Extension Point for which to register Extensions
   */
  registerExtensions(extensionPoint: string): Promise<void>;

  /**
   * Return {@link ExtensionInfo} instances for all registered Extensions implementing the specified Extension Point.
   *
   * @param extensionPoint the Extension Point for which to return {@link ExtensionInfo} instances
   *
   * @return array of {@link ExtensionInfo}
   */
  getRegisteredExtensions(
    extensionPoint: string,
  ): Promise<ReadonlyArray<ExtensionInfo>>;

  /**
   * Instantiate a specific Extension.
   *
   * @param extensionHandle the opaque handle for the Extension provided by this Extension Manager instance via
   * {@link ExtensionInfo.extensionHandle}.
   * @param hostData optional data to be passed in to the Extension when instantiating it.
   *
   * @return an Extension instance implementing an Extension Point.
   */
  instantiate(
    extensionHandle: string,
    hostData?: Map<string, string>,
  ): Promise<unknown>;
}
