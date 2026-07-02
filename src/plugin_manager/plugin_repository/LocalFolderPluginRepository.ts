import type VersionedPluginRepository from "../../api/plugin_repository/VersionedPluginRepository.ts";
import type ExtensionDescriptor from "../../api/plugin/ExtensionDescriptor.ts";
import type ExtensionEntry from "../../api/plugin_repository/ExtensionEntry.ts";
import type VersionedPluginDescriptor from "../../api/plugin_repository/VersionedPluginDescriptor.ts";
import loadPlugin from "../util/PluginLoader.ts";

interface ManifestEntry {
  pluginId: string;
  bundlePath: string;
  pluginData?: Record<string, string>;
  extensionPoints: string[];
  scope?: string;
  name: string;
  version: string;
  dependencies?: Array<{ scope?: string; name: string; versionRange: string }>;
}

/**
 * {@link VersionedPluginRepository} backed by a local folder containing plugin bundle files.
 *
 * Tracks installed plugins via a JSON manifest file (`manifestFileName`) written to
 * `pluginFolderPath`. Used as the local installation target by {@link HttpPluginInstaller}.
 */
export default class LocalFolderPluginRepository implements VersionedPluginRepository {
  public constructor(
    public readonly pluginFolderPath: string,
    public readonly manifestFileName: string,
  ) {}

  private get manifestPath(): string {
    return `${this.pluginFolderPath}/${this.manifestFileName}`;
  }

  public async readManifest(): Promise<ManifestEntry[]> {
    const file = Bun.file(this.manifestPath);
    const exists = await file.exists();
    if (!exists) {
      return [];
    }
    const text = await file.text();
    return JSON.parse(text) as ManifestEntry[];
  }

  public async writeManifest(entries: ManifestEntry[]): Promise<void> {
    await Bun.write(this.manifestPath, JSON.stringify(entries, null, 2));
  }

  private entryToDescriptor(entry: ManifestEntry): VersionedPluginDescriptor {
    return {
      pluginId: entry.pluginId,
      extensionPoints: entry.extensionPoints,
      pluginData: entry.pluginData ? new Map(Object.entries(entry.pluginData)) : undefined,
      scope: entry.scope,
      name: entry.name,
      version: entry.version,
      dependencies: entry.dependencies,
    };
  }

  private async *getPluginsAsyncIterable(): AsyncIterable<VersionedPluginDescriptor> {
    const entries = await this.readManifest();
    for (const entry of entries) {
      yield this.entryToDescriptor(entry);
    }
  }

  public getPlugins(): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    return this.getPluginsAsyncIterable();
  }

  public async getPlugin(
    pluginId: string,
  ): Promise<Readonly<VersionedPluginDescriptor> | undefined> {
    const entries = await this.readManifest();
    const entry = entries.find((e) => e.pluginId === pluginId);
    return entry ? this.entryToDescriptor(entry) : undefined;
  }

  private async *scanForExtensionsAsyncIterable(
    extensionPoint: string,
  ): AsyncIterable<ExtensionEntry> {
    const entries = await this.readManifest();
    for (const entry of entries) {
      if (!entry.extensionPoints.includes(extensionPoint)) {
        continue;
      }
      const result = await loadPlugin(entry.bundlePath);
      if (!result.isValidPlugin || !result.plugin) {
        continue;
      }
      for (let i = 0; i < result.plugin.extensionDescriptors.length; i++) {
        const ed = result.plugin.extensionDescriptors[i]!;
        if (ed.extensionPoint !== extensionPoint) {
          continue;
        }
        yield {
          pluginId: entry.pluginId,
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
    const entries = await this.readManifest();
    const entry = entries.find((e) => e.pluginId === extensionEntry.pluginId);
    if (!entry) {
      return Promise.reject(new Error(`Plugin ID ${extensionEntry.pluginId} is unknown`));
    }
    const result = await loadPlugin(entry.bundlePath);
    if (!result.isValidPlugin || !result.plugin) {
      return Promise.reject(new Error(`Failed to load plugin from ${entry.bundlePath}`));
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
