import type PluginInstaller from "./PluginInstaller.ts";
import type VersionedPluginDescriptor from "../plugin_repository/VersionedPluginDescriptor.ts";
import type VersionedPluginRepository from "../plugin_repository/VersionedPluginRepository.ts";

/**
 * Extends {@link PluginInstaller} with dependency-aware installation, dependent-safety guards on
 * uninstall, and update checking between a local and a remote {@link VersionedPluginRepository}.
 */
export default interface VersionedPluginInstaller extends PluginInstaller {
  /**
   * Install a versioned plugin from a source repository into a target repository.
   *
   * @param descriptor the {@link VersionedPluginDescriptor} identifying the plugin to install.
   * @param source the {@link VersionedPluginRepository} from which to obtain the plugin.
   * @param target the {@link VersionedPluginRepository} into which to install the plugin.
   * @param options.includeDependencies if `true`, recursively install any missing dependencies
   *   from the same source repository. If `false` (default), throws if a required dependency
   *   is not already present in the target.
   */
  install(
    descriptor: Readonly<VersionedPluginDescriptor>,
    source: VersionedPluginRepository,
    target: VersionedPluginRepository,
    options?: { includeDependencies?: boolean },
  ): Promise<void>;

  /**
   * Remove a plugin from a versioned repository.
   *
   * Throws if another installed plugin in the target repository declares a dependency on the
   * plugin being removed.
   *
   * @param pluginId the ID of the plugin to remove.
   * @param target the {@link VersionedPluginRepository} from which to remove the plugin.
   */
  uninstall(pluginId: string, target: VersionedPluginRepository): Promise<void>;

  /**
   * Compare a local repository against a remote repository and yield entries where a newer
   * version is available remotely.
   *
   * @param local the local {@link VersionedPluginRepository} representing installed plugins.
   * @param remote the remote {@link VersionedPluginRepository} representing available plugins.
   *
   * @return an async iterable of objects pairing the remote {@link VersionedPluginDescriptor}
   *   with the available version string.
   */
  checkForUpdates(
    local: VersionedPluginRepository,
    remote: VersionedPluginRepository,
  ): AsyncIterable<{ descriptor: Readonly<VersionedPluginDescriptor>; availableVersion: string }>;
}
