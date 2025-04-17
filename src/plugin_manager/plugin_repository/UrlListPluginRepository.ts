import type PluginRepository from "./PluginRepository.ts";
import type ExtensionDescriptor from "../../api/plugin/ExtensionDescriptor.ts";
import type ExtensionEntry from "./ExtensionEntry.ts";
import UrlPluginSource from "./UrlPluginSource.ts";

/**
 * Implementation of {@link PluginRepository} using a provided set of URLs to access Plugins.
 * Each plugin URL is linked to a list of extension points that are available in the Plugin.
 *
 * When scanning for Plugins each provided URL will be used to attempt to load a Plugin and examine it.
 */
export default class UrlListPluginRepository implements PluginRepository {
  private readonly pluginSource = new UrlPluginSource();

  /**
   * Constructor configures the instance using the specified set of URLs.
   *
   * @throws *Error* if the URL set contains a non-valid URL.
   */
  public constructor(
    private readonly urlsAndExtensionPoints: Set<
      { url: string; extensionPoints: string[] }
    >,
  ) {
    if (!urlsAndExtensionPoints || (urlsAndExtensionPoints.size === 0)) {
      throw new Error(
        `Undefined or empty set of URL and extension points provided`,
      );
    }
    this.urlsAndExtensionPoints.forEach((urlAndExtensionPoint) => {
      try {
        new URL(urlAndExtensionPoint.url);
      } catch (err) {
        throw new Error(
          `Cannot parse ${urlAndExtensionPoint.url} as a URL: ${
            (err as Error).message
          }`,
        );
      }
      if (
        !urlAndExtensionPoint.extensionPoints ||
        (urlAndExtensionPoint.extensionPoints.length === 0)
      ) {
        throw new Error(`Undefined or empty set of extension points provided`);
      }
    });
  }

  private async *getExtensionEntryAsyncIterable(
    extensionPoint: string,
  ): AsyncIterable<ExtensionEntry> {
    // We need to iterate each entry and filter for extensionPoint
    for await (const urlAndExtensionPoints of this.urlsAndExtensionPoints) {
      if (!urlAndExtensionPoints.extensionPoints.includes(extensionPoint)) {
        continue;
      }
      const plugin = await this.pluginSource.loadPlugin(
        new URL(urlAndExtensionPoints.url),
      );

      if (plugin) {
        // Once we have loaded the plugin, double check on the extension points in the plugin
        // filter Extensions in each Plugin by specified Extension Point
        // and map any matches to an Extension Entry
        for (let i = 0; i < plugin.extensionDescriptors.length; i++) {
          const extensionDescripter = plugin.extensionDescriptors[i];
          if (extensionDescripter.extensionPoint !== extensionPoint) {
            continue;
          }
          yield {
            pluginId: urlAndExtensionPoints.url,
            extensionId: `${i}`,
            extensionPoint,
            pluginData: plugin.pluginData,
            extensionData: extensionDescripter.extensionData,
          };
        }
      }
    }
  }

  public scanForExtensions(
    extensionPoint: string,
  ): AsyncIterable<ExtensionEntry> {
    return this.getExtensionEntryAsyncIterable(extensionPoint);
  }

  /**
   * @inheritDoc
   *
   * @throws *Error* if the specified ExtensionEntry is unknown.
   */
  public async getExtensionDescriptorFromExtensionEntry(
    extensionEntry: ExtensionEntry,
  ): Promise<Readonly<ExtensionDescriptor>> {
    const plugin = await this.pluginSource.loadPlugin(
      new URL(extensionEntry.pluginId),
    );

    if (!plugin) {
      return Promise.reject(`Plugin ID ${extensionEntry.pluginId} is unknown`);
    }

    let extensionId = -1;

    try {
      extensionId = parseInt(extensionEntry.extensionId);
    } catch (_e) {
      return Promise.reject(
        `Extension ID ${extensionEntry.extensionId} is unknown`,
      );
    }

    if (
      (extensionId < 0) || (extensionId >= plugin.extensionDescriptors.length)
    ) {
      return Promise.reject(
        `Extension ID ${extensionEntry.extensionId} is unknown`,
      );
    }

    return Promise.resolve(plugin.extensionDescriptors[extensionId]);
  }
}
