import { readdir } from "node:fs/promises";
import path from "node:path";
import type VersionedPluginRepository from "../../api/plugin_repository/VersionedPluginRepository.ts";
import type ExtensionDescriptor from "../../api/plugin/ExtensionDescriptor.ts";
import type ExtensionEntry from "../../api/plugin_repository/ExtensionEntry.ts";
import type VersionedPluginDescriptor from "../../api/plugin_repository/VersionedPluginDescriptor.ts";
import loadPlugin from "../util/PluginLoader.ts";

interface PackageExports {
  [key: string]: string | PackageExports;
}

// Resolve the best entry file for a plugin package, preferring a pre-bundled "default"
// entry over the "bun" TypeScript source. In compiled Bun binaries, dynamic imports of
// TypeScript files that in turn import external packages via specifiers (e.g. peer deps)
// fail because package resolution doesn't cross into compiled-binary bundles.
async function resolvePluginEntry(pluginPath: string): Promise<string> {
  const pkgJsonPath = path.join(pluginPath, "package.json");
  const pkgFile = Bun.file(pkgJsonPath);
  if (!(await pkgFile.exists())) return pluginPath;

  const pkg = (await pkgFile.json()) as Record<string, unknown>;
  const exports = pkg["exports"] as PackageExports | undefined;
  const rootExport = exports?.["."] as PackageExports | undefined;

  const candidates: (string | undefined)[] = [
    rootExport?.["default"] as string | undefined,
    pkg["main"] as string | undefined,
    rootExport?.["bun"] as string | undefined,
  ];

  for (const rel of candidates) {
    if (!rel || typeof rel !== "string") continue;
    const abs = path.join(pluginPath, rel);
    if (await Bun.file(abs).exists()) return abs;
  }

  return pluginPath;
}

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
          // pass scope without the leading "@" so getPluginId() can prepend it correctly
          const descriptor = await this.readPackageDescriptor(packageName, dirName.slice(1));
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
      pluginName = packageName.slice(packageName.indexOf("/") + 1);
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

  public async getPlugin(pluginId: string): Promise<Readonly<VersionedPluginDescriptor> | undefined> {
    const scope = pluginId.startsWith("@") ? pluginId.slice(1, pluginId.indexOf("/")) : undefined;
    return this.readPackageDescriptor(pluginId, scope);
  }

  private async *scanForExtensionsAsyncIterable(
    extensionPoint: string,
  ): AsyncIterable<ExtensionEntry> {
    for await (const descriptor of this.getPluginsAsyncIterable()) {
      if (!descriptor.extensionPoints.includes(extensionPoint)) {
        continue;
      }
      const pluginPath = path.join(this.nodeModulesPath, descriptor.pluginId);
      const entryPath = await resolvePluginEntry(pluginPath);
      const result = await loadPlugin(entryPath);
      if (!result.isValidPlugin || !result.plugin) {
        continue;
      }
      for (let i = 0; i < result.plugin.extensionDescriptors.length; i++) {
        const ed = result.plugin.extensionDescriptors[i]!;
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
    const pluginPath = path.join(this.nodeModulesPath, extensionEntry.pluginId);
    const entryPath = await resolvePluginEntry(pluginPath);
    const result = await loadPlugin(entryPath);
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
    return result.plugin.extensionDescriptors[extensionId]!;
  }
}
