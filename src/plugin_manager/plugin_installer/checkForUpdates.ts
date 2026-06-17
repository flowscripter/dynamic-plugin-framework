import semver from "semver";
import type VersionedPluginDescriptor from "../../api/plugin_repository/VersionedPluginDescriptor.ts";
import type VersionedPluginRepository from "../../api/plugin_repository/VersionedPluginRepository.ts";

export async function* checkForUpdates(
  local: VersionedPluginRepository,
  remote: VersionedPluginRepository,
): AsyncIterable<{ descriptor: Readonly<VersionedPluginDescriptor>; availableVersion: string }> {
  const remotePlugins: VersionedPluginDescriptor[] = [];
  for await (const p of remote.getPlugins()) {
    remotePlugins.push({ ...p });
  }

  for await (const localPlugin of local.getPlugins()) {
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
