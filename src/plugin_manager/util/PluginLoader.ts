import { builtinModules } from "node:module";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type Plugin from "../../api/plugin/Plugin.ts";
import type FetchInterface from "../../api/fetch/FetchInterface.ts";
import { isBunRuntime } from "../../shared/Runtime.ts";
import semver from "semver";
import { getSharedModule, isSharedModuleRegistered } from "../../shared/SharedModules.ts";

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

async function getLocalUrl(
  remoteUrl: string,
  cacheFolder: string,
  repoName: string,
  fetchFn: FetchInterface["fetch"],
) {
  const url = new URL(remoteUrl);
  const urlPath = url.pathname;

  const localPluginPath = path.join(cacheFolder, repoName, urlPath);
  const installePluginFile = Bun.file(localPluginPath);
  const exists = await installePluginFile.exists();

  if (exists) {
    return localPluginPath;
  }

  await mkdir(path.dirname(localPluginPath), { recursive: true });

  const result = await fetchFn(remoteUrl);

  await Bun.write(installePluginFile, result);

  return localPluginPath;
}

function isRemoteUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.startsWith("http://") || lower.startsWith("https://");
}

const BUILTIN_SPECIFIERS = new Set(builtinModules);

function isBareSpecifier(specifier: string): boolean {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.includes(":")) {
    return false;
  }
  return specifier !== "bun" && !BUILTIN_SPECIFIERS.has(specifier);
}

/**
 * @returns the first bare import in the source which is neither a builtin nor registered as a shared module.
 * @throws if the source cannot be scanned.
 */
function findUnprovidedImport(source: string): string | undefined {
  const imports = new Bun.Transpiler({ loader: "js" }).scanImports(source);
  for (const { path: specifier, kind } of imports) {
    if (kind !== "internal" && isBareSpecifier(specifier) && !isSharedModuleRegistered(specifier)) {
      return specifier;
    }
  }
  return undefined;
}

function checkSharedModules(url: string, plugin: Plugin): Error | undefined {
  const sharedModules = plugin.sharedModules;
  if (sharedModules === undefined) {
    return undefined;
  }
  for (const [specifier, range] of Object.entries(sharedModules)) {
    const shared = getSharedModule(specifier);
    if (shared === undefined) {
      return new Error(
        `Plugin from ${url} requires shared module '${specifier}' which is not provided by the host`,
      );
    }
    if (semver.validRange(range) === null) {
      return new Error(
        `Plugin from ${url} declares invalid version range '${range}' for shared module '${specifier}'`,
      );
    }
    if (shared.version === undefined) {
      console.warn(
        `Host provides shared module '${specifier}' without a version; cannot check range '${range}' required by plugin from ${url}`,
      );
      continue;
    }
    if (!semver.satisfies(shared.version, range, { includePrerelease: true })) {
      return new Error(
        `Plugin from ${url} requires '${specifier}' ${range} but host provides ${shared.version}`,
      );
    }
  }
  return undefined;
}

/**
 * Utility function to import a specified module and validate it is a {@link Plugin} implementation.
 *
 * If the URL specified is http(s):// the remote item is fetched into the cache folder and the cached file is
 * imported i.e. a local dynamic import is performed. This is because the Bun runtime does not support importing
 * remote modules directly as per https://github.com/oven-sh/bun/issues/38
 *
 * Before a fetched file is imported its imports are scanned. If it has a bare import which is neither a
 * builtin nor registered via `registerSharedModules` the plugin is rejected, so that the runtime never attempts
 * to resolve (or auto-install) the package itself.
 *
 * If the loaded {@link Plugin} declares {@link Plugin.sharedModules} each entry is checked against the modules
 * the host has registered.
 *
 * Under a runtime without `Bun` (e.g. a browser) the URL is imported directly and no scanning is performed;
 * shared modules are expected to be supplied by an import map.
 *
 * @param url the URL of the module to import.
 */
export default async function loadPlugin(
  url: string,
  cacheFolder: string = path.join(os.homedir(), ".flowscripter", "plugin"),
  repoName: string = "default",
  fetchFn: FetchInterface["fetch"] = fetch,
): Promise<Readonly<PluginLoadResult>> {
  const result: PluginLoadResult = {
    isValidPlugin: false,
    plugin: undefined,
    error: undefined,
  };

  let module;

  try {
    if (!isBunRuntime()) {
      module = await import(url);
    } else if (isRemoteUrl(url)) {
      const localUrl = await getLocalUrl(url, cacheFolder, repoName, fetchFn);
      const unprovided = findUnprovidedImport(await Bun.file(localUrl).text());
      if (unprovided !== undefined) {
        result.error = new Error(
          `Plugin from ${url} imports '${unprovided}' which is not provided by the host (register it with registerSharedModules)`,
        );
        return result;
      }
      module = await import(localUrl);
    } else {
      module = await import(url);
    }
  } catch (err) {
    result.error = err as Error;
    if (!isBunRuntime() && err instanceof TypeError) {
      result.error = new Error(`${err.message} (add the module to the import map of the host)`, {
        cause: err,
      });
    }
    return result;
  }

  const potentialPlugin = module.default;

  // check the assumed Plugin has an array of extension descriptors
  if (!Array.isArray(potentialPlugin.extensionDescriptors)) {
    result.error = new Error(`Plugin from ${url} does not provide an extensionDescriptors array`);
    return result;
  }

  // At this point assume it is a valid plugin and then disprove this
  result.isValidPlugin = true;

  for (const potentialExtensionDescriptor of potentialPlugin.extensionDescriptors) {
    // check for valid {@link ExtensionDescriptor.extensionPoint}
    if (
      potentialExtensionDescriptor.extensionPoint === undefined ||
      (!((potentialExtensionDescriptor.extensionPoint as unknown) instanceof String) &&
        typeof potentialExtensionDescriptor.extensionPoint !== "string")
    ) {
      result.isValidPlugin = false;
      result.error = new Error(
        `Plugin from ${url} does not provide an extensionPoint string in one of the extensionDescriptors`,
      );
      return result;
    }
    // check for valid {@link ExtensionDescriptor.factory.create function}
    if (
      potentialExtensionDescriptor.factory === undefined ||
      potentialExtensionDescriptor.factory.create === undefined ||
      !((potentialExtensionDescriptor.factory.create as unknown) instanceof Function)
    ) {
      result.isValidPlugin = false;
      result.error = new Error(
        `Plugin from ${url} does not provide a factory with a create function in one of the extensionDescriptors`,
      );
      return result;
    }
  }

  const sharedModulesError = checkSharedModules(url, potentialPlugin);
  if (sharedModulesError !== undefined) {
    result.isValidPlugin = false;
    result.error = sharedModulesError;
    return result;
  }

  result.plugin = potentialPlugin;
  return result;
}
