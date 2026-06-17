import DefaultMarketplacePluginManager from "./DefaultMarketplacePluginManager.ts";
import type HttpManifestPluginRepository from "./plugin_repository/HttpManifestPluginRepository.ts";
import type LocalFolderPluginRepository from "./plugin_repository/LocalFolderPluginRepository.ts";
import type HttpPluginInstaller from "./plugin_installer/HttpPluginInstaller.ts";

/**
 * {@link DefaultMarketplacePluginManager} for HTTP manifest-backed marketplaces.
 *
 * Combines one or more {@link HttpManifestPluginRepository} remotes with a local
 * {@link LocalFolderPluginRepository} and an {@link HttpPluginInstaller}.
 */
export default class HttpPluginManager extends DefaultMarketplacePluginManager<
  HttpManifestPluginRepository,
  LocalFolderPluginRepository,
  HttpPluginInstaller
> {}
