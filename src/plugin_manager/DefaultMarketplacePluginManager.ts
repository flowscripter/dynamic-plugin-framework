import semver from "semver";
import type MarketplacePluginManager from "../api/plugin_manager/MarketplacePluginManager.ts";
import type MarketplacePluginRepository from "../api/plugin_repository/MarketplacePluginRepository.ts";
import type VersionedPluginRepository from "../api/plugin_repository/VersionedPluginRepository.ts";
import type ExtensionInfo from "../api/plugin_manager/ExtensionInfo.ts";
import type SearchQuery from "../api/plugin_repository/SearchQuery.ts";
import type VersionedPluginDescriptor from "../api/plugin_repository/VersionedPluginDescriptor.ts";
import DefaultPluginManager from "./DefaultPluginManager.ts";

/**
 * Abstract {@link MarketplacePluginManager} implementation.
 *
 * Combines one or more `TRemote` repositories (for search and install source) with a `TLocal`
 * repository (for loading installed plugins). The standard {@link PluginManager} methods delegate
 * to an internal {@link DefaultPluginManager} backed by the local repository only.
 *
 * Provides a concrete {@link checkForUpdates} implementation. Subclasses must implement
 * {@link install} and {@link uninstall} with ecosystem-specific logic
 * (e.g. {@link HttpPluginManager}, {@link NpmPluginManager}).
 */
export default abstract class DefaultMarketplacePluginManager<
  TRemote extends MarketplacePluginRepository,
  TLocal extends VersionedPluginRepository,
> implements MarketplacePluginManager {
  private readonly pluginManager: DefaultPluginManager;

  public constructor(
    protected readonly remotes: TRemote[],
    protected readonly local: TLocal,
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

  public abstract install(
    descriptor: Readonly<VersionedPluginDescriptor>,
    options?: { includeDependencies?: boolean },
  ): Promise<void>;

  public abstract uninstall(pluginId: string): Promise<void>;

  private async *checkForUpdatesIterable(
    remote: VersionedPluginRepository,
  ): AsyncIterable<{ descriptor: Readonly<VersionedPluginDescriptor>; availableVersion: string }> {
    const remotePlugins: VersionedPluginDescriptor[] = [];
    for await (const p of remote.getPlugins()) {
      remotePlugins.push({ ...p });
    }

    for await (const localPlugin of this.local.getPlugins()) {
      const localId = localPlugin.scope
        ? `${localPlugin.scope}/${localPlugin.name}`
        : localPlugin.name;
      for (const remotePlugin of remotePlugins) {
        const remoteId = remotePlugin.scope
          ? `${remotePlugin.scope}/${remotePlugin.name}`
          : remotePlugin.name;
        if (remoteId === localId && semver.gt(remotePlugin.version, localPlugin.version)) {
          yield { descriptor: remotePlugin, availableVersion: remotePlugin.version };
          break;
        }
      }
    }
  }

  public checkForUpdates(
    remote?: VersionedPluginRepository,
  ): AsyncIterable<{ descriptor: Readonly<VersionedPluginDescriptor>; availableVersion: string }> {
    const r = remote ?? this.remotes[0];
    if (!r) {
      throw new Error("No remote repository configured");
    }
    return this.checkForUpdatesIterable(r);
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
