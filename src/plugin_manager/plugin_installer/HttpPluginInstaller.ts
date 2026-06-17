import { mkdir } from "node:fs/promises";
import path from "node:path";
import semver from "semver";
import type VersionedPluginInstaller from "../../api/plugin_installer/VersionedPluginInstaller.ts";
import type VersionedPluginDescriptor from "../../api/plugin_repository/VersionedPluginDescriptor.ts";
import type VersionedPluginRepository from "../../api/plugin_repository/VersionedPluginRepository.ts";
import type LocalFolderPluginRepository from "../plugin_repository/LocalFolderPluginRepository.ts";
import type HttpManifestPluginRepository from "../plugin_repository/HttpManifestPluginRepository.ts";
import { checkForUpdates } from "./checkForUpdates.ts";

export default class HttpPluginInstaller implements VersionedPluginInstaller {
  public async install(
    descriptor: Readonly<VersionedPluginDescriptor>,
    source: VersionedPluginRepository,
    target: VersionedPluginRepository,
    options?: { includeDependencies?: boolean },
  ): Promise<void> {
    const src = source as HttpManifestPluginRepository;
    const tgt = target as LocalFolderPluginRepository;

    await this.installOne(descriptor, src, tgt, options?.includeDependencies ?? false);
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

        // check if already satisfied in target
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

        // find in source
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

    // check if already installed
    const manifest = await target.readManifest();
    const existing = manifest.find((e) => e.pluginId === descriptor.pluginId);
    if (existing) return;

    // fetch bundle
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

  public async uninstall(pluginId: string, target: VersionedPluginRepository): Promise<void> {
    const tgt = target as LocalFolderPluginRepository;
    const manifest = await tgt.readManifest();

    const entry = manifest.find((e) => e.pluginId === pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} is not installed`);
    }

    // check for dependents
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

    // remove bundle file
    try {
      await Bun.file(entry.bundlePath).exists(); // ensure accessible
      const { unlink } = await import("node:fs/promises");
      await unlink(entry.bundlePath);
    } catch {
      // ignore file removal errors
    }

    const updated = manifest.filter((e) => e.pluginId !== pluginId);
    await tgt.writeManifest(updated);
  }

  public checkForUpdates(
    local: VersionedPluginRepository,
    remote: VersionedPluginRepository,
  ): AsyncIterable<{ descriptor: Readonly<VersionedPluginDescriptor>; availableVersion: string }> {
    return checkForUpdates(local, remote);
  }
}
