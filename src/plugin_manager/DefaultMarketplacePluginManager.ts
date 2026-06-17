import type MarketplacePluginManager from "../api/plugin_manager/MarketplacePluginManager.ts";
import type MarketplacePluginRepository from "../api/plugin_repository/MarketplacePluginRepository.ts";
import type VersionedPluginRepository from "../api/plugin_repository/VersionedPluginRepository.ts";
import type VersionedPluginInstaller from "../api/plugin_installer/VersionedPluginInstaller.ts";
import type ExtensionInfo from "../api/plugin_manager/ExtensionInfo.ts";
import type SearchQuery from "../api/plugin_repository/SearchQuery.ts";
import type VersionedPluginDescriptor from "../api/plugin_repository/VersionedPluginDescriptor.ts";
import DefaultPluginManager from "./DefaultPluginManager.ts";

/**
 * Generic {@link MarketplacePluginManager} implementation.
 *
 * Combines one or more `TRemote` repositories (for search and install source) with a `TLocal`
 * repository (for loading installed plugins) and a `TInstaller`. The standard
 * {@link PluginManager} methods delegate to an internal {@link DefaultPluginManager} backed by
 * the local repository only.
 *
 * Concrete subclasses fix the type parameters for a specific ecosystem
 * (e.g. {@link HttpPluginManager}, {@link NpmPluginManager}).
 */
export default class DefaultMarketplacePluginManager<
  TRemote extends MarketplacePluginRepository,
  TLocal extends VersionedPluginRepository,
  TInstaller extends VersionedPluginInstaller,
> implements MarketplacePluginManager {
  private readonly pluginManager: DefaultPluginManager;

  public constructor(
    protected readonly remotes: TRemote[],
    protected readonly local: TLocal,
    protected readonly installer: TInstaller,
  ) {
    this.pluginManager = new DefaultPluginManager([local]);
  }

  private async *searchAsyncIterable(
    query: Readonly<SearchQuery>,
  ): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    for (const remote of this.remotes) {
      yield* remote.search(query);
    }
  }

  public search(query: Readonly<SearchQuery>): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    return this.searchAsyncIterable(query);
  }

  public async install(
    descriptor: Readonly<VersionedPluginDescriptor>,
    options?: { includeDependencies?: boolean },
  ): Promise<void> {
    for (const remote of this.remotes) {
      for await (const d of remote.getPlugins()) {
        if (d.pluginId === descriptor.pluginId) {
          return this.installer.install(descriptor, remote, this.local, options);
        }
      }
    }
    if (this.remotes.length > 0) {
      return this.installer.install(descriptor, this.remotes[0], this.local, options);
    }
    throw new Error(`Plugin ${descriptor.pluginId} not found in any configured remote repository`);
  }

  public registerExtensions(extensionPoint: string): Promise<void> {
    return this.pluginManager.registerExtensions(extensionPoint);
  }

  public getRegisteredExtensions(extensionPoint: string): Promise<ReadonlyArray<ExtensionInfo>> {
    return this.pluginManager.getRegisteredExtensions(extensionPoint);
  }

  public instantiate(extensionHandle: string, hostData?: Map<string, string>): Promise<unknown> {
    return this.pluginManager.instantiate(extensionHandle, hostData);
  }
}
