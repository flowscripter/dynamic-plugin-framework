import type Plugin from "../../api/plugin/Plugin.ts";
import loadPlugin from "../util/PluginLoader.ts";
import os from "node:os";
import path from "node:path";

/**
 * Loads and caches {@link Plugin} instances from remote or local URLs.
 *
 * Plugins are fetched via dynamic `import()` (delegating to {@link PluginLoader}) and
 * cached in memory by URL so repeated calls for the same URL are served without
 * re-fetching.
 */
export default class UrlPluginSource {
  private readonly pluginsByUrl: Map<URL, Plugin> = new Map();
  private readonly cacheFolder: string;

  /**
   * @param cacheFolder Directory used to cache downloaded plugin bundles.
   *   Defaults to `~/.flowscripter/plugin`.
   */
  public constructor(cacheFolder: string = path.join(os.homedir(), ".flowscripter", "plugin")) {
    this.cacheFolder = cacheFolder;
  }

  /**
   * Load the plugin at `url`, returning the cached instance on subsequent calls.
   *
   * @param url URL of the plugin bundle to load.
   * @returns The loaded {@link Plugin}, or `undefined` if the module exists but is
   *   not a valid plugin.
   * @throws If the module cannot be fetched or fails to load.
   */
  public async loadPlugin(url: URL): Promise<Plugin | undefined> {
    let plugin = this.pluginsByUrl.get(url);

    if (!plugin) {
      const pluginLoadResult = await loadPlugin(url.toString(), this.cacheFolder);
      if (pluginLoadResult.isValidPlugin && pluginLoadResult.plugin !== undefined) {
        plugin = pluginLoadResult.plugin;
        this.pluginsByUrl.set(url, plugin);
      }
      if (pluginLoadResult.error) {
        throw new Error(`Failed to load plugin from ${url}: ${pluginLoadResult.error.message}`);
      }
    }
    return Promise.resolve(this.pluginsByUrl.get(url));
  }
}
