import type PluginRepository from "./PluginRepository.ts";
import type ExtensionDescriptor from "../../api/plugin/ExtensionDescriptor.ts";
import type ExtensionEntry from "./ExtensionEntry.ts";
import UrlPluginSource from "./UrlPluginSource.ts";

/**
 * Implementation of {@link PluginRepository} using a provided set of URLs to access Plugins.
 *
 * When scanning for Plugins each provided URL will be used to attempt to load a Plugin and examine it.
 */
export default class UrlListPluginRepository implements PluginRepository {
  private readonly urls: Set<string>;
  private readonly pluginSource = new UrlPluginSource();

  /**
   * Constructor configures the instance using the specified set of URLs.
   *
   * @throws *Error* if the URL set contains a non-valid URL.
   */
  public constructor(urls: Set<string>) {
    if (!urls || (urls.size === 0)) {
      throw new Error(`Undefined or empty set of URLs provided`);
    }
    this.urls = urls;
    this.urls.forEach((url) => {
      try {
        new URL(url);
      } catch (err) {
        throw new Error(
          `Cannot parse ${url} as a URL: ${(err as Error).message}`,
        );
      }
    });
  }

  private async *getExtensionEntryAsyncIterable(
    extensionPoint: string,
  ): AsyncIterable<ExtensionEntry> {
    // As this is just a list of URLs we need to load each and then filter for extensionPoint
    for await (const candidateUrl of this.urls) {
      const plugin = await this.pluginSource.loadPlugin(new URL(candidateUrl));

      if (plugin) {
        // filter Extensions in each Plugin by specified Extension Point
        // and map any matches to an Extension Entry
        for (let i = 0; i < plugin.extensionDescriptors.length; i++) {
          const extensionDescripter = plugin.extensionDescriptors[i];
          if (extensionDescripter.extensionPoint !== extensionPoint) {
            continue;
          }
          yield {
            pluginId: candidateUrl,
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
