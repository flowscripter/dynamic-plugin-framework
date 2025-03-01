import type ExtensionPointRegistry from "./registry/ExtensionPointRegistry.ts";
import type ExtensionRegistry from "./registry/ExtensionRegistry.ts";
import InMemoryExtensionPointRegistry from "./registry/InMemoryExtensionPointRegistry.ts";
import InMemoryExtensionRegistry from "./registry/InMemoryExtensionRegistry.ts";
import type PluginManager from "../api/plugin_manager/PluginManager.ts";
import type ExtensionInfo from "../api/plugin_manager/ExtensionInfo.ts";
import type PluginRepository from "./plugin_repository/PluginRepository.ts";

/**
 * Default implementation of a {@link PluginManager}.
 */
export default class DefaultPluginManager implements PluginManager {
  private readonly extensionPointRegistry: ExtensionPointRegistry;
  private readonly extensionRegistry: ExtensionRegistry;
  private readonly pluginRepositoriesByExtensionHandle = new Map<
    string,
    PluginRepository
  >();

  /**
   * Constructor configures the instance using the optionally specified
   * {@link ExtensionPointRegistry} and {@link ExtensionRegistry}.
   *
   * @param pluginRepositories One or more {@link PluginRepository} instances to use for plugin discovery.
   * @param extensionPointRegistry optional {@link ExtensionPointRegistry]] implementation. Defaults to using
   * {@link InMemoryExtensionPointRegistry}.
   * @param extensionRegistry optional {@link ExtensionRegistry} implementation. Defaults to using
   * {@link InMemoryExtensionRegistry}
   */
  public constructor(
    private readonly pluginRepositories: Array<PluginRepository>,
    extensionPointRegistry?: ExtensionPointRegistry,
    extensionRegistry?: ExtensionRegistry,
  ) {
    this.extensionPointRegistry = extensionPointRegistry ||
      new InMemoryExtensionPointRegistry();
    this.extensionRegistry = extensionRegistry ||
      new InMemoryExtensionRegistry();
  }

  public async registerExtensions(extensionPoint: string): Promise<void> {
    if (await this.extensionPointRegistry.isRegistered(extensionPoint)) {
      return Promise.resolve();
    }

    await this.extensionPointRegistry.register(extensionPoint);

    for (let i = 0; i < this.pluginRepositories.length; i++) {
      const pluginRepository = this.pluginRepositories[i];
      for await (
        const extensionEntry of pluginRepository.scanForExtensions(
          extensionPoint,
        )
      ) {
        const extensionHandle =
          `${i}:${extensionEntry.pluginId}:${extensionEntry.extensionId}`;

        this.pluginRepositoriesByExtensionHandle.set(
          extensionHandle,
          pluginRepository,
        );
        await this.extensionRegistry.register(extensionHandle, extensionEntry);
      }
    }
  }

  public async getRegisteredExtensions(
    extensionPoint: string,
  ): Promise<ReadonlyArray<ExtensionInfo>> {
    const extensionMap = await this.extensionRegistry.getExtensions(
      extensionPoint,
    );
    const registeredExtensions = new Array<ExtensionInfo>();

    extensionMap.forEach((entry, handle) => {
      registeredExtensions.push({
        extensionHandle: handle,
        extensionData: entry.extensionData,
        pluginData: entry.pluginData,
      });
    });

    return Promise.resolve(registeredExtensions);
  }

  /**
   * @inheritDoc
   *
   * @throws *Error* if the specified Extension Handle is unknown
   */
  public async instantiate(
    extensionHandle: string,
    hostData?: Map<string, string>,
  ): Promise<unknown> {
    // Get the Extension Entry for the Extension Handle
    const extensionEntry = await this.extensionRegistry.get(extensionHandle);

    // Get the Plugin Repository for the Extension Handle
    const pluginRepository = this.pluginRepositoriesByExtensionHandle.get(
      extensionHandle,
    );

    if (!pluginRepository) {
      return Promise.reject(`Extension handle ${extensionHandle} is unknown`);
    }
    // Get the Extension Descriptor from the Plugin Repository
    const extensionDescriptor = await pluginRepository
      .getExtensionDescriptorFromExtensionEntry(extensionEntry);

    return extensionDescriptor.factory.create(hostData);
  }
}
