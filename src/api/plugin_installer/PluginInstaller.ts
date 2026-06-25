import type PluginDescriptor from "../plugin_repository/PluginDescriptor.ts";
import type PluginRepository from "../plugin_repository/PluginRepository.ts";

/**
 * Transfers plugins between {@link PluginRepository} instances.
 *
 * A `PluginInstaller` is decoupled from both the source and target repositories, allowing
 * different backing mechanisms (HTTP fetch, subprocess package manager, etc.) to be composed freely.
 */
export default interface PluginInstaller {
  /**
   * Install a plugin from a source repository into a target repository.
   *
   * @param descriptor the {@link PluginDescriptor} identifying the plugin to install.
   * @param source the {@link PluginRepository} from which to obtain the plugin.
   * @param target the {@link PluginRepository} into which to install the plugin.
   */
  install(
    descriptor: Readonly<PluginDescriptor>,
    source: PluginRepository,
    target: PluginRepository,
  ): Promise<void>;

  /**
   * Remove a plugin from a repository.
   *
   * @param pluginId the ID of the plugin to remove.
   * @param target the {@link PluginRepository} from which to remove the plugin.
   */
  uninstall(pluginId: string, target: PluginRepository): Promise<void>;
}
