import type MarketplacePluginRepository from "../../api/plugin_repository/MarketplacePluginRepository.ts";
import type ExtensionDescriptor from "../../api/plugin/ExtensionDescriptor.ts";
import type ExtensionEntry from "../../api/plugin_repository/ExtensionEntry.ts";
import type VersionedPluginDescriptor from "../../api/plugin_repository/VersionedPluginDescriptor.ts";
import type SearchQuery from "../../api/plugin_repository/SearchQuery.ts";
import loadPlugin from "../util/PluginLoader.ts";

interface RemoteManifestEntry {
  bundleUrl: string;
  pluginData?: Record<string, string>;
  extensionPoints: string[];
  scope?: string;
  name: string;
  version: string;
  dependencies?: Array<{ scope?: string; name: string; versionRange: string }>;
}

/**
 * {@link MarketplacePluginRepository} backed by a remote JSON manifest file.
 *
 * Fetches a manifest from `manifestUrl` (an array of plugin entries) on first use and caches
 * it in memory. Supports free-text search across plugin name, scope, and extension point IDs.
 * Plugin bundles are downloaded and cached in `cacheFolder` when extensions are instantiated.
 */
export default class HttpManifestPluginRepository implements MarketplacePluginRepository {
  public readonly name: string;
  public readonly description?: string;
  public readonly author?: string;
  public readonly url: string;

  private readonly cacheFolder: string;
  private cachedManifest: RemoteManifestEntry[] | undefined;

  public constructor({
    manifestUrl,
    name,
    description,
    author,
    cacheFolder,
  }: {
    manifestUrl: string;
    name: string;
    description?: string;
    author?: string;
    cacheFolder: string;
  }) {
    this.url = manifestUrl;
    this.name = name;
    this.description = description;
    this.author = author;
    this.cacheFolder = cacheFolder;
  }

  private async fetchManifest(): Promise<RemoteManifestEntry[]> {
    if (this.cachedManifest) {
      return this.cachedManifest;
    }
    const response = await fetch(this.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest from ${this.url}: ${response.statusText}`);
    }
    this.cachedManifest = (await response.json()) as RemoteManifestEntry[];
    return this.cachedManifest;
  }

  private entryToDescriptor(entry: RemoteManifestEntry): VersionedPluginDescriptor {
    return {
      pluginId: entry.bundleUrl,
      extensionPoints: entry.extensionPoints,
      pluginData: entry.pluginData ? new Map(Object.entries(entry.pluginData)) : undefined,
      scope: entry.scope,
      name: entry.name,
      version: entry.version,
      dependencies: entry.dependencies,
    };
  }

  private async *getPluginsAsyncIterable(): AsyncIterable<VersionedPluginDescriptor> {
    const entries = await this.fetchManifest();
    for (const entry of entries) {
      yield this.entryToDescriptor(entry);
    }
  }

  public getPlugins(): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    return this.getPluginsAsyncIterable();
  }

  public async getPlugin(pluginId: string): Promise<Readonly<VersionedPluginDescriptor> | undefined> {
    const entries = await this.fetchManifest();
    const entry = entries.find((e) => e.bundleUrl === pluginId);
    return entry ? this.entryToDescriptor(entry) : undefined;
  }

  private async *searchAsyncIterable(
    query: Readonly<SearchQuery>,
  ): AsyncIterable<VersionedPluginDescriptor> {
    const entries = await this.fetchManifest();
    const text = query.text?.toLowerCase();
    for (const entry of entries) {
      if (!text) {
        yield this.entryToDescriptor(entry);
        continue;
      }
      const matches =
        entry.name.toLowerCase().includes(text) ||
        (entry.scope?.toLowerCase().includes(text) ?? false) ||
        entry.extensionPoints.some((ep) => ep.toLowerCase().includes(text));
      if (matches) {
        yield this.entryToDescriptor(entry);
      }
    }
  }

  public search(query: Readonly<SearchQuery>): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    return this.searchAsyncIterable(query);
  }

  private async *scanForExtensionsAsyncIterable(
    extensionPoint: string,
  ): AsyncIterable<ExtensionEntry> {
    const entries = await this.fetchManifest();
    for (const entry of entries) {
      if (!entry.extensionPoints.includes(extensionPoint)) {
        continue;
      }
      const result = await loadPlugin(entry.bundleUrl, this.cacheFolder, this.name);
      if (!result.isValidPlugin || !result.plugin) {
        continue;
      }
      for (let i = 0; i < result.plugin.extensionDescriptors.length; i++) {
        const ed = result.plugin.extensionDescriptors[i]!;
        if (ed.extensionPoint !== extensionPoint) {
          continue;
        }
        yield {
          pluginId: entry.bundleUrl,
          extensionId: `${i}`,
          extensionPoint,
          pluginData: entry.pluginData ? new Map(Object.entries(entry.pluginData)) : undefined,
          extensionData: ed.extensionData,
        };
      }
    }
  }

  public scanForExtensions(extensionPoint: string): AsyncIterable<Readonly<ExtensionEntry>> {
    return this.scanForExtensionsAsyncIterable(extensionPoint);
  }

  public async getExtensionDescriptorFromExtensionEntry(
    extensionEntry: ExtensionEntry,
  ): Promise<Readonly<ExtensionDescriptor>> {
    const result = await loadPlugin(extensionEntry.pluginId, this.cacheFolder, this.name);
    if (!result.isValidPlugin || !result.plugin) {
      return Promise.reject(new Error(`Failed to load plugin from ${extensionEntry.pluginId}`));
    }
    const extensionId = parseInt(extensionEntry.extensionId);
    if (
      isNaN(extensionId) ||
      extensionId < 0 ||
      extensionId >= result.plugin.extensionDescriptors.length
    ) {
      return Promise.reject(new Error(`Extension ID ${extensionEntry.extensionId} is unknown`));
    }
    return result.plugin.extensionDescriptors[extensionId]!;
  }
}
