import type ExtensionEntry from "./ExtensionEntry.ts";
import type ExtensionDescriptor from "../../api/plugin/ExtensionDescriptor.ts";

/**
 * A source of {@link Plugin} implementations.
 */
export default interface PluginRepository {
  /**
   * Return an {@link ExtensionEntry} for each Extension hosted in the Plugin Repository which provides an
   * Extension for the specified Extension Point.
   *
   * @param extensionPoint the Extension Point for which to return {@link ExtensionEntry} instances.
   *
   * @return an async iterable of {@link ExtensionEntry} instances for all matching Extensions.
   */
  scanForExtensions(
    extensionPoint: string,
  ): AsyncIterable<Readonly<ExtensionEntry>>;

  /**
   * Return the {@link ExtensionDescriptor} for the Extension identified by the specified {@link ExtensionEntry}.
   *
   * @param extensionEntry the {@link extensionEntry} for the desired Extension.
   *
   * @return an {@link ExtensionDescriptor} instance.
   */
  getExtensionDescriptorFromExtensionEntry(
    extensionEntry: ExtensionEntry,
  ): Promise<Readonly<ExtensionDescriptor>>;
}
