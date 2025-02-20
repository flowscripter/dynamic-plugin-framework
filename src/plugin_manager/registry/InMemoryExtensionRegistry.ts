import type ExtensionRegistry from "./ExtensionRegistry.ts";
import type ExtensionEntry from "../plugin_repository/ExtensionEntry.ts";

/**
 * Simple implementation of an {@link ExtensionRegistry} using an in-memory map.
 */
export default class InMemoryExtensionRegistry implements ExtensionRegistry {
  private readonly extensionEntriesByHandle: Map<string, ExtensionEntry> =
    new Map();

  private readonly extensionEntriesByExtensionPoint: Map<
    string,
    Map<string, ExtensionEntry>
  > = new Map();

  /**
   * @inheritDoc
   *
   * @throws *Error* if the specified Extension handle has already been registered
   */
  public register(
    extensionHandle: string,
    extensionEntry: ExtensionEntry,
  ): Promise<void> {
    if (this.extensionEntriesByHandle.has(extensionHandle)) {
      return Promise.reject(
        `Extension handle ${extensionHandle} has already been registered`,
      );
    }
    this.extensionEntriesByHandle.set(extensionHandle, extensionEntry);

    let extensionEntries = this.extensionEntriesByExtensionPoint.get(
      extensionEntry.extensionPoint,
    );

    if (extensionEntries === undefined) {
      extensionEntries = new Map();
      this.extensionEntriesByExtensionPoint.set(
        extensionEntry.extensionPoint,
        extensionEntries,
      );
    }
    extensionEntries.set(extensionHandle, extensionEntry);

    return Promise.resolve();
  }

  /**
   * @inheritDoc
   *
   * @throws *Error* if the specified Extension handle has not been registered
   */
  public get(extensionHandle: string): Promise<Readonly<ExtensionEntry>> {
    const extensionEntry = this.extensionEntriesByHandle.get(extensionHandle);

    if (!extensionEntry) {
      return Promise.reject(`Extension handle ${extensionHandle} is unknown`);
    }
    return Promise.resolve(Object.freeze(extensionEntry));
  }

  public getExtensions(
    extensionPoint: string,
  ): Promise<ReadonlyMap<string, ExtensionEntry>> {
    return Promise.resolve(
      this.extensionEntriesByExtensionPoint.get(extensionPoint) || new Map(),
    );
  }
}
