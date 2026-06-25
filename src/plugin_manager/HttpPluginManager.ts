import { mkdir } from "node:fs/promises";
import path from "node:path";
import semver from "semver";
import DefaultMarketplacePluginManager from "./DefaultMarketplacePluginManager.ts";
import type HttpManifestPluginRepository from "./plugin_repository/HttpManifestPluginRepository.ts";
import type LocalFolderPluginRepository from "./plugin_repository/LocalFolderPluginRepository.ts";
import type VersionedPluginDescriptor from "../api/plugin_repository/VersionedPluginDescriptor.ts";

/**
 * {@link DefaultMarketplacePluginManager} for HTTP manifest-backed marketplaces.
 *
 * Combines one or more {@link HttpManifestPluginRepository} remotes with a local
 * {@link LocalFolderPluginRepository}. Plugins are installed by fetching their bundle
 * via HTTP and persisting a manifest entry.
 */
export default class HttpPluginManager extends DefaultMarketplacePluginManager<
  HttpManifestPluginRepository,
  LocalFolderPluginRepository
> {
  public async install(
    descriptor: Readonly<VersionedPluginDescriptor>,
    options?: { includeDependencies?: boolean },
  ): Promise<void> {
    let source: HttpManifestPluginRepository | undefined;
    for (const remote of this.remotes) {
      for await (const d of remote.getPlugins()) {
        if (d.pluginId === descriptor.pluginId) {
          source = remote;
          break;
        }
      }
      if (source) break;
    }
    if (!source) {
      if (this.remotes.length === 0) {
        throw new Error(
          `Plugin ${descriptor.pluginId} not found in any configured remote repository`,
        );
      }
      source = this.remotes[0];
    }
    await this.installOne(descriptor, source, this.local, options?.includeDependencies ?? false);
  }

  private async installOne(
    descriptor: Readonly<VersionedPluginDescriptor>,
    source: HttpManifestPluginRepository,
    target: LocalFolderPluginRepository,
    includeDependencies: boolean,
  ): Promise<void> {
    if (includeDependencies && descriptor.dependencies) {
      for (const dep of descriptor.dependencies) {
        const depId = dep.scope ? `${dep.scope}/${dep.name}` : dep.name;

        let satisfied = false;
        for await (const installed of target.getPlugins()) {
          const installedId = installed.scope
            ? `${installed.scope}/${installed.name}`
            : installed.name;
          if (installedId === depId && semver.satisfies(installed.version, dep.versionRange)) {
            satisfied = true;
            break;
          }
        }
        if (satisfied) continue;

        let found: Readonly<VersionedPluginDescriptor> | undefined;
        for await (const remote of source.getPlugins()) {
          const remoteId = remote.scope ? `${remote.scope}/${remote.name}` : remote.name;
          if (remoteId === depId && semver.satisfies(remote.version, dep.versionRange)) {
            found = remote;
            break;
          }
        }
        if (!found) {
          throw new Error(`Dependency ${depId}@${dep.versionRange} not found in source repository`);
        }
        await this.installOne(found, source, target, includeDependencies);
      }
    }

    const manifest = await target.readManifest();
    const existing = manifest.find((e) => e.pluginId === descriptor.pluginId);
    if (existing) return;

    const bundleUrl = descriptor.pluginId;
    const response = await fetch(bundleUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch bundle from ${bundleUrl}: ${response.statusText}`);
    }

    const safeName = descriptor.scope
      ? `${descriptor.scope.replace("@", "")}__${descriptor.name}@${descriptor.version}.js`
      : `${descriptor.name}@${descriptor.version}.js`;
    await mkdir(target.pluginFolderPath, { recursive: true });
    const bundlePath = path.join(target.pluginFolderPath, safeName);
    await Bun.write(bundlePath, response);

    const pluginDataObj: Record<string, string> | undefined = descriptor.pluginData
      ? Object.fromEntries(descriptor.pluginData)
      : undefined;

    manifest.push({
      pluginId: descriptor.pluginId,
      bundlePath,
      pluginData: pluginDataObj,
      extensionPoints: descriptor.extensionPoints,
      scope: descriptor.scope,
      name: descriptor.name,
      version: descriptor.version,
      dependencies: descriptor.dependencies
        ? descriptor.dependencies.map((d) => ({
            scope: d.scope,
            name: d.name,
            versionRange: d.versionRange,
          }))
        : undefined,
    });
    await target.writeManifest(manifest);
  }

  public async uninstall(pluginId: string): Promise<void> {
    const manifest = await this.local.readManifest();

    const entry = manifest.find((e) => e.pluginId === pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} is not installed`);
    }

    for (const other of manifest) {
      if (other.pluginId === pluginId) continue;
      if (!other.dependencies) continue;
      const nameToMatch = entry.scope ? `${entry.scope}/${entry.name}` : entry.name;
      for (const dep of other.dependencies) {
        const depId = dep.scope ? `${dep.scope}/${dep.name}` : dep.name;
        if (depId === nameToMatch) {
          throw new Error(`Cannot uninstall ${pluginId}: plugin ${other.pluginId} depends on it`);
        }
      }
    }

    try {
      await Bun.file(entry.bundlePath).exists();
      const { unlink } = await import("node:fs/promises");
      await unlink(entry.bundlePath);
    } catch {
      // ignore file removal errors
    }

    const updated = manifest.filter((e) => e.pluginId !== pluginId);
    await this.local.writeManifest(updated);
  }
}
