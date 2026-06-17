import DefaultMarketplacePluginManager from "./DefaultMarketplacePluginManager.ts";
import type NpmjsPluginRepository from "./plugin_repository/NpmjsPluginRepository.ts";
import type NpmPluginRepository from "./plugin_repository/NpmPluginRepository.ts";
import type NpmPluginInstaller from "./plugin_installer/NpmPluginInstaller.ts";

/**
 * {@link DefaultMarketplacePluginManager} for the npm ecosystem.
 *
 * Combines one or more {@link NpmjsPluginRepository} remotes with a local
 * {@link NpmPluginRepository} (backed by `node_modules`) and an {@link NpmPluginInstaller}.
 */
export default class NpmPluginManager extends DefaultMarketplacePluginManager<
  NpmjsPluginRepository,
  NpmPluginRepository,
  NpmPluginInstaller
> {}
