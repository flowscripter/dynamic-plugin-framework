import semver from "semver";
import type MarketplacePluginManager from "../api/plugin_manager/MarketplacePluginManager.ts";
import type MarketplacePluginRepository from "../api/plugin_repository/MarketplacePluginRepository.ts";
import type VersionedPluginRepository from "../api/plugin_repository/VersionedPluginRepository.ts";
import type ExtensionInfo from "../api/plugin_manager/ExtensionInfo.ts";
import type PluginManager from "../api/plugin_manager/PluginManager.ts";
import type SearchQuery from "../api/plugin_repository/SearchQuery.ts";
import type VersionedPluginDescriptor from "../api/plugin_repository/VersionedPluginDescriptor.ts";
import type FetchCapable from "../api/fetch/FetchCapable.ts";
import type FetchInterface from "../api/fetch/FetchInterface.ts";
import DefaultPluginManager from "./DefaultPluginManager.ts";

function isFetchCapable(value: unknown): value is FetchCapable {
  return typeof value === "object" && value !== null && "setFetch" in value;
}

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
export default abstract class BaseMarketplacePluginManager<
  TRemote extends MarketplacePluginRepository,
  TLocal extends VersionedPluginRepository,
> implements MarketplacePluginManager, FetchCapable {
  private readonly pluginManager: PluginManager;
  protected fetchInterface: FetchInterface | undefined;

  /**
   * @param remotes marketplace repositories used for search and as install sources.
   * @param local repository used to load installed plugins.
   * @param pluginManager optional {@link PluginManager} to delegate {@link registerExtensions},
   * {@link getRegisteredExtensions} and {@link instantiate} to. Defaults to a
   * {@link DefaultPluginManager} backed by `local`. Provide this to supply a custom
   * {@link PluginManager} implementation.
   */
  public constructor(
    protected readonly remotes: TRemote[],
    protected readonly local: TLocal,
    pluginManager?: PluginManager,
  ) {
    this.pluginManager = pluginManager ?? new DefaultPluginManager([local]);
  }

  /**
   * Supplies a host-provided {@link FetchInterface} to this manager and forwards it to its
   * `remotes`/`local` repositories, for those which support {@link FetchCapable}.
   */
  public setFetch(fetchInterface: FetchInterface): void {
    this.fetchInterface = fetchInterface;
    for (const remote of this.remotes) {
      if (isFetchCapable(remote)) {
        remote.setFetch(fetchInterface);
      }
    }
    if (isFetchCapable(this.local)) {
      this.local.setFetch(fetchInterface);
    }
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
    for await (const localPlugin of this.local.getPlugins()) {
      const localId = localPlugin.scope
        ? `${localPlugin.scope}/${localPlugin.name}`
        : localPlugin.name;
      const remotePlugin = await remote.getPlugin(localId);
      if (remotePlugin && semver.gt(remotePlugin.version, localPlugin.version)) {
        yield { descriptor: remotePlugin, availableVersion: remotePlugin.version };
      }
    }
  }

  public listInstalled(): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    return this.local.getPlugins();
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
