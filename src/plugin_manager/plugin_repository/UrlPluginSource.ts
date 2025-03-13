import type Plugin from "../../api/plugin/Plugin.ts";
import loadPlugin from "../util/PluginLoader.ts";

/**
 * A source of {@link Plugin} instances sourced from URLs.
 *
 * Any loaded URLs will be cached so that subsequent calls to {@link loadPlugin} are (possibly) lower cost.
 */
export default class UrlPluginSource {
  private readonly pluginsByUrl: Map<URL, Plugin> = new Map();

  /**
   * Attempt to load a {@link Plugin} object from the specified URL.
   *
   * @param url the URL to load from
   *
   * @returns a {@link Plugin} object if successful otherwise undefined
   */
  public async loadPlugin(url: URL): Promise<Plugin | undefined> {
    let plugin = this.pluginsByUrl.get(url);

    if (!plugin) {
      const pluginLoadResult = await loadPlugin(url.toString());
      if (
        pluginLoadResult.isValidPlugin &&
        (pluginLoadResult.plugin !== undefined)
      ) {
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
