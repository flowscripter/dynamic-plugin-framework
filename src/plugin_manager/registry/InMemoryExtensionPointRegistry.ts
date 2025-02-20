import type ExtensionPointRegistry from "./ExtensionPointRegistry.ts";

/**
 * Simple implementation of an {@link ExtensionPointRegistry} using an in-memory Set.
 */
export default class InMemoryExtensionPointRegistry
  implements ExtensionPointRegistry {
  private readonly extensionPoints: Set<string> = new Set();

  /**
   * @inheritDoc
   *
   * @throws *Error* if the specified Extension Point has already been registered
   */
  public async register(extensionPoint: string): Promise<void> {
    if (await this.isRegistered(extensionPoint)) {
      throw new Error(`Extension Point ${extensionPoint} already registered`);
    }
    this.extensionPoints.add(extensionPoint);
  }

  public getAll(): Promise<ReadonlySet<string>> {
    return Promise.resolve(this.extensionPoints);
  }

  public isRegistered(extensionPoint: string): Promise<boolean> {
    return Promise.resolve(this.extensionPoints.has(extensionPoint));
  }
}
