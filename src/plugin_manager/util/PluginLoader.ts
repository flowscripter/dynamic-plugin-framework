import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type Plugin from "../../api/plugin/Plugin.ts";

/**
 * Result of a {@link loadPlugin} invocation.
 */
export interface PluginLoadResult {
  /**
   * `true` if the module at the specified URL is a valid {@link Plugin} implementation.
   */
  isValidPlugin: boolean;

  /**
   * Populated with the {@link Plugin} object if {@link PluginLoadResult.isValidPlugin} is `true`
   */
  plugin: Plugin | undefined;

  /**
   * Populated if {@link PluginLoadResult.isValidPlugin} is `false`
   */
  error?: Error;
}

async function getLocalUrl(remoteUrl: string) {
  const url = new URL(remoteUrl);
  const urlPath = url.pathname;

  // look in local cache location
  const localPluginFolder = path.join(os.homedir(), ".flowscripter", "plugin");
  const localPluginPath = path.join(localPluginFolder, urlPath);
  const installePluginFile = Bun.file(localPluginPath);
  const exists = await installePluginFile.exists();

  if (exists) {
    return localPluginPath;
  }

  await mkdir(path.dirname(localPluginPath), { recursive: true });

  const result = await fetch(remoteUrl);

  await Bun.write(installePluginFile, result);

  return localPluginPath;
}

/**
 * Utility function to import a specified module and validate it is a {@link Plugin} implementation.
 *
 * If the URL specified is not local filesystem (e.g. http(s)://) and the dynamic import fails with ENOENT
 * then the remote item will be fetched and the contents of the response will be used as the module source
 * i.e. a local dynamic import will be attempted.  This is because the Bun runtime does not support importing
 * remote modules directly as per https://github.com/oven-sh/bun/issues/38
 *
 * @param url the URL of the module to import.
 */
export default async function loadPlugin(
  url: string,
): Promise<Readonly<PluginLoadResult>> {
  const result: PluginLoadResult = {
    isValidPlugin: false,
    plugin: undefined,
    error: undefined,
  };

  let module;

  try {
    module = await import(url);
  } catch (err) {
    if ((err instanceof Error) && (err.message === "ENOENT")) {
      const urlLower = url.toLowerCase();
      if (urlLower.startsWith("http://") || urlLower.startsWith("https://")) {
        const localUrl = await getLocalUrl(url);

        try {
          module = await import(localUrl);
        } catch (err2) {
          result.error = err2 as Error;
          return result;
        }
      }
    }
    result.error = err as Error;
    return result;
  }

  const potentialPlugin = module.default;

  // check the assumed Plugin has an array of extension descriptors
  if (!Array.isArray(potentialPlugin.extensionDescriptors)) {
    result.error = new Error(
      `Plugin from ${url} does not provide an extensionDescriptors array`,
    );
    return result;
  }

  // At this point assume it is a valid plugin and then disprove this
  result.isValidPlugin = true;

  for (
    const potentialExtensionDescriptor of potentialPlugin
      .extensionDescriptors
  ) {
    // check for valid {@link ExtensionDescriptor.extensionPoint}
    if (
      (potentialExtensionDescriptor.extensionPoint === undefined) ||
      (!(potentialExtensionDescriptor.extensionPoint as unknown instanceof
        String) &&
        (typeof potentialExtensionDescriptor.extensionPoint !== "string"))
    ) {
      result.isValidPlugin = false;
      result.error = new Error(
        `Plugin from ${url} does not provide an extensionPoint string in one of the extensionDescriptors`,
      );
      return result;
    }
    // check for valid {@link ExtensionDescriptor.factory.create function}
    if (
      (potentialExtensionDescriptor.factory === undefined) ||
      (potentialExtensionDescriptor.factory.create === undefined) ||
      !(potentialExtensionDescriptor.factory.create as unknown instanceof
        Function)
    ) {
      result.isValidPlugin = false;
      result.error = new Error(
        `Plugin from ${url} does not provide a factory with a create function in one of the extensionDescriptors`,
      );
      return result;
    }
  }

  result.plugin = potentialPlugin;
  return result;
}
