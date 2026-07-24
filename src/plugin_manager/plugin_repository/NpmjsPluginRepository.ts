import type MarketplacePluginRepository from "../../api/plugin_repository/MarketplacePluginRepository.ts";
import type ExtensionDescriptor from "../../api/plugin/ExtensionDescriptor.ts";
import type ExtensionEntry from "../../api/plugin_repository/ExtensionEntry.ts";
import type VersionedPluginDescriptor from "../../api/plugin_repository/VersionedPluginDescriptor.ts";
import type SearchQuery from "../../api/plugin_repository/SearchQuery.ts";
import type FetchCapable from "../../api/fetch/FetchCapable.ts";
import type FetchInterface from "../../api/fetch/FetchInterface.ts";

export interface NpmSearchQuery extends SearchQuery {
  readonly keywords?: string[];
}

interface NpmSearchResult {
  objects: Array<{
    package: {
      name: string;
      version: string;
      description?: string;
      keywords?: string[];
      links?: { npm?: string };
    };
  }>;
}

interface NpmPackageMeta {
  extensionPoints?: string[];
  pluginDependencies?: Array<{ scope?: string; name: string; versionRange: string }>;
  pluginData?: Record<string, string>;
}

export interface NpmjsPluginRepositoryConfig {
  name: string;
  description?: string;
  author?: string;
  registryUrl: string;
  packageJsonNamespace: string;
  authToken?: string;
  username?: string;
  password?: string;
}

/**
 * {@link MarketplacePluginRepository} backed by an npm-compatible registry (e.g. npmjs.com).
 *
 * Discovers plugins via the registry's `/-/v1/search` endpoint, filtering by a keyword matching
 * `packageJsonNamespace`. Plugin metadata (extension points, dependencies, pluginData) is read
 * from the `packageJsonNamespace` key in each package's `package.json`. Supports keyword-based
 * search via {@link NpmSearchQuery}.
 *
 * Note: extensions cannot be instantiated directly from this repository — plugins must first be
 * installed locally via {@link NpmPluginInstaller}.
 */
export default class NpmjsPluginRepository implements MarketplacePluginRepository, FetchCapable {
  public readonly name: string;
  public readonly description?: string;
  public readonly author?: string;
  public readonly url: string;

  private readonly registryUrl: string;
  private readonly packageJsonNamespace: string;
  private readonly metaCache: Map<string, NpmPackageMeta> = new Map();
  private readonly authToken?: string;
  private readonly username?: string;
  private readonly password?: string;
  private fetchFn: FetchInterface["fetch"] = (input, init) => fetch(input, init);

  public constructor({
    name,
    description,
    author,
    registryUrl,
    packageJsonNamespace,
    authToken,
    username,
    password,
  }: NpmjsPluginRepositoryConfig) {
    if (authToken !== undefined && (username !== undefined || password !== undefined)) {
      throw new Error("Cannot specify both authToken and username/password auth");
    }
    this.name = name;
    this.description = description;
    this.author = author;
    this.registryUrl = registryUrl;
    this.url = registryUrl;
    this.packageJsonNamespace = packageJsonNamespace;
    this.authToken = authToken;
    this.username = username;
    this.password = password;
  }

  public setFetch(fetchInterface: FetchInterface): void {
    this.fetchFn = fetchInterface.fetch.bind(fetchInterface);
  }

  private buildHeaders(): Headers {
    const headers = new Headers();
    if (this.authToken) {
      headers.set("Authorization", `Bearer ${this.authToken}`);
    } else if (this.username !== undefined && this.password !== undefined) {
      const encoded = btoa(`${this.username}:${this.password}`);
      headers.set("Authorization", `Basic ${encoded}`);
    }
    return headers;
  }

  private parsePackageName(packageName: string): { scope: string | undefined; shortName: string } {
    if (packageName.startsWith("@")) {
      const slash = packageName.indexOf("/");
      if (slash !== -1) {
        return {
          scope: packageName.slice(1, slash),
          shortName: packageName.slice(slash + 1),
        };
      }
    }
    return { scope: undefined, shortName: packageName };
  }

  private async fetchPackageMeta(packageName: string): Promise<NpmPackageMeta> {
    const cached = this.metaCache.get(packageName);
    if (cached) return cached;

    const doc = await this.fetchPackageDoc(packageName);
    const meta = (doc?.[this.packageJsonNamespace] as NpmPackageMeta | undefined) ?? {};
    this.metaCache.set(packageName, meta);
    return meta;
  }

  private async fetchPackageDoc(packageName: string): Promise<Record<string, unknown> | undefined> {
    const response = await this.fetchFn(`${this.registryUrl}/${packageName}/latest`, {
      headers: this.buildHeaders(),
    });
    if (!response.ok) {
      return undefined;
    }
    return (await response.json()) as Record<string, unknown>;
  }

  private async *searchAsyncIterable(
    query: Readonly<NpmSearchQuery>,
  ): AsyncIterable<VersionedPluginDescriptor> {
    // Search by keyword only to ensure reliable results from npm's search ranking.
    // Text filtering is applied client-side to avoid packages being buried in results.
    let searchText = `keywords:${this.packageJsonNamespace}`;
    if (query.keywords) {
      for (const kw of query.keywords) {
        searchText += `+keywords:${kw}`;
      }
    }

    const response = await this.fetchFn(
      `${this.registryUrl}/-/v1/search?text=${encodeURIComponent(searchText)}&size=250`,
      { headers: this.buildHeaders() },
    );
    if (!response.ok) {
      throw new Error(`npmjs search failed: ${response.statusText}`);
    }
    const result = (await response.json()) as NpmSearchResult;

    const textFilter = query.text?.toLowerCase();
    for (const obj of result.objects) {
      const pkg = obj.package;
      if (!pkg.keywords?.includes(this.packageJsonNamespace)) continue;
      if (textFilter && !pkg.name.toLowerCase().includes(textFilter)) continue;

      const meta = await this.fetchPackageMeta(pkg.name);
      if (!meta.extensionPoints?.length) continue;

      const { scope, shortName } = this.parsePackageName(pkg.name);

      yield {
        pluginId: pkg.name,
        extensionPoints: meta.extensionPoints ?? [],
        pluginData: meta.pluginData ? new Map(Object.entries(meta.pluginData)) : undefined,
        scope,
        name: shortName,
        version: pkg.version,
        dependencies: meta.pluginDependencies,
      };
    }
  }

  public search(query: Readonly<SearchQuery>): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    return this.searchAsyncIterable(query as NpmSearchQuery);
  }

  public getPlugins(): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    return this.searchAsyncIterable({ text: "" });
  }

  public async getPlugin(
    pluginId: string,
  ): Promise<Readonly<VersionedPluginDescriptor> | undefined> {
    const doc = await this.fetchPackageDoc(pluginId);
    if (!doc) return undefined;

    const keywords = doc["keywords"] as string[] | undefined;
    if (!keywords?.includes(this.packageJsonNamespace)) return undefined;

    const meta = (doc[this.packageJsonNamespace] as NpmPackageMeta | undefined) ?? {};
    if (!meta.extensionPoints?.length) return undefined;

    this.metaCache.set(pluginId, meta);
    const { scope, shortName } = this.parsePackageName(pluginId);

    return {
      pluginId,
      extensionPoints: meta.extensionPoints ?? [],
      pluginData: meta.pluginData ? new Map(Object.entries(meta.pluginData)) : undefined,
      scope,
      name: shortName,
      version: doc["version"] as string,
      dependencies: meta.pluginDependencies,
    };
  }

  private async *scanForExtensionsAsyncIterable(
    extensionPoint: string,
  ): AsyncIterable<ExtensionEntry> {
    for await (const descriptor of this.getPlugins()) {
      if (!descriptor.extensionPoints.includes(extensionPoint)) continue;
      yield {
        pluginId: descriptor.pluginId,
        extensionId: "0",
        extensionPoint,
        pluginData: descriptor.pluginData,
      };
    }
  }

  public scanForExtensions(extensionPoint: string): AsyncIterable<Readonly<ExtensionEntry>> {
    return this.scanForExtensionsAsyncIterable(extensionPoint);
  }

  public getExtensionDescriptorFromExtensionEntry(
    _extensionEntry: ExtensionEntry,
  ): Promise<Readonly<ExtensionDescriptor>> {
    return Promise.reject(
      new Error(
        "Cannot instantiate from a remote marketplace repository - install the plugin locally first",
      ),
    );
  }
}
