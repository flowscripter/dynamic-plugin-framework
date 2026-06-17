import { readdir } from "node:fs/promises";
import path from "node:path";
import type VersionedPluginRepository from "../../api/plugin_repository/VersionedPluginRepository.ts";
import type ExtensionDescriptor from "../../api/plugin/ExtensionDescriptor.ts";
import type ExtensionEntry from "../../api/plugin_repository/ExtensionEntry.ts";
import type VersionedPluginDescriptor from "../../api/plugin_repository/VersionedPluginDescriptor.ts";
import loadPlugin from "../util/PluginLoader.ts";

interface PackageJsonNamespaceData {
  extensionPoints?: string[];
  pluginDependencies?: Array<{ scope?: string; name: string; versionRange: string }>;
  pluginData?: Record<string, string>;
}

/**
 * {@link VersionedPluginRepository} backed by a local `node_modules` directory.
 *
 * Discovers installed plugins by scanning `nodeModulesPath` for packages that contain a
 * `packageJsonNamespace` key in their `package.json`. That key's value provides extension points,
 * dependencies, and pluginData. Used as the local installation target by {@link NpmPluginInstaller}.
 */
export default class NpmPluginRepository implements VersionedPluginRepository {
  public constructor(
    public readonly nodeModulesPath: string,
    public readonly packageJsonNamespace: string,
  ) {}

  private async *getPluginsAsyncIterable(): AsyncIterable<VersionedPluginDescriptor> {
    let topLevelDirs: string[];
    try {
      topLevelDirs = await readdir(this.nodeModulesPath);
    } catch {
      return;
    }

    for (const dirName of topLevelDirs) {
      if (dirName.startsWith(".") || dirName === "node_modules") {
        continue;
      }

      if (dirName.startsWith("@")) {
        // scoped packages: read subdirectory
        const scopedPath = path.join(this.nodeModulesPath, dirName);
        let scopedDirs: string[];
        try {
          scopedDirs = await readdir(scopedPath);
        } catch {
          continue;
        }
        for (const scopedName of scopedDirs) {
          if (scopedName.startsWith(".")) continue;
          const packageName = `${dirName}/${scopedName}`;
          const descriptor = await this.readPackageDescriptor(packageName, dirName);
          if (descriptor) yield descriptor;
        }
      } else {
        const descriptor = await this.readPackageDescriptor(dirName, undefined);
        if (descriptor) yield descriptor;
      }
    }
  }

  private async readPackageDescriptor(
    packageName: string,
    scope: string | undefined,
  ): Promise<VersionedPluginDescriptor | undefined> {
    const pkgPath = path.join(this.nodeModulesPath, packageName, "package.json");
    const file = Bun.file(pkgPath);
    const exists = await file.exists();
    if (!exists) return undefined;

    let pkg: Record<string, unknown>;
    try {
      const text = await file.text();
      pkg = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return undefined;
    }

    const nsData = pkg[this.packageJsonNamespace] as PackageJsonNamespaceData | undefined;
    if (!nsData || !nsData.extensionPoints) return undefined;

    const version = (pkg["version"] as string | undefined) ?? "0.0.0";

    let pluginName: string;
    if (scope) {
      pluginName = packageName.slice(scope.length + 1);
    } else {
      pluginName = packageName;
    }

    return {
      pluginId: packageName,
      extensionPoints: nsData.extensionPoints,
      pluginData: nsData.pluginData ? new Map(Object.entries(nsData.pluginData)) : undefined,
      scope: scope,
      name: pluginName,
      version,
      dependencies: nsData.pluginDependencies,
    };
  }

  public getPlugins(): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    return this.getPluginsAsyncIterable();
  }

  private async *scanForExtensionsAsyncIterable(
    extensionPoint: string,
  ): AsyncIterable<ExtensionEntry> {
    for await (const descriptor of this.getPluginsAsyncIterable()) {
      if (!descriptor.extensionPoints.includes(extensionPoint)) {
        continue;
      }
      const result = await loadPlugin(descriptor.pluginId);
      if (!result.isValidPlugin || !result.plugin) {
        continue;
      }
      for (let i = 0; i < result.plugin.extensionDescriptors.length; i++) {
        const ed = result.plugin.extensionDescriptors[i];
        if (ed.extensionPoint !== extensionPoint) {
          continue;
        }
        yield {
          pluginId: descriptor.pluginId,
          extensionId: `${i}`,
          extensionPoint,
          pluginData: descriptor.pluginData,
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
    const result = await loadPlugin(extensionEntry.pluginId);
    if (!result.isValidPlugin || !result.plugin) {
      return Promise.reject(new Error(`Failed to load plugin ${extensionEntry.pluginId}`));
    }
    const extensionId = parseInt(extensionEntry.extensionId);
    if (
      isNaN(extensionId) ||
      extensionId < 0 ||
      extensionId >= result.plugin.extensionDescriptors.length
    ) {
      return Promise.reject(new Error(`Extension ID ${extensionEntry.extensionId} is unknown`));
    }
    return result.plugin.extensionDescriptors[extensionId];
  }
}
