import Plugin from "../../api/plugin/Plugin.ts";

/**
 * Type alias for a Plugin Constructor
 */
type PluginConstructorType = new () => Plugin;

/**
 * Result of a {@link loadPlugin} invocation.
 */
export interface PluginLoadResult {
  /**
   * `true` if the module at the specified URL is a valid {@link Plugin} implementation.
   */
  isValidPlugin: boolean;

  /**
   * Populated with the instantiated {@link Plugin} instance if {@link PluginLoadResult.isValidPlugin} is `true`
   */
  instance: Plugin | undefined;

  /**
   * Populated if {@link PluginLoadResult.isValidPlugin} is `false`
   */
  error?: Error;
}

function isPluginConstructor(test: unknown): test is PluginConstructorType {
  // https://stackoverflow.com/questions/39334278/check-if-object-is-a-constructor-isconstructor
  try {
    new Proxy(test as Plugin, {
      construct() {
        return {};
      },
    });
    return true;
  } catch (_err) {
    return false;
  }
}

/**
 * Utility function to import a specified module and validate it is a {@link Plugin} implementation.
 *
 * @param url the URL of the module to import
 */
export default async function loadPlugin(
  url: string,
): Promise<Readonly<PluginLoadResult>> {
  const result: PluginLoadResult = {
    isValidPlugin: false,
    instance: undefined,
    error: undefined,
  };

  let module;

  try {
    module = await import(url);
  } catch (err) {
    result.error = err;
    return result;
  }

  const PotentialPlugin = module.default;

  // check if default export looks like a Plugin Constructor
  if (!isPluginConstructor(PotentialPlugin)) {
    result.error = new Error(
      `Default export of module ${url} is not a Plugin constructor`,
    );
    return result;
  }

  // attempt to instantiate assumed Plugin
  let potentialPluginInstance: Plugin;
  try {
    potentialPluginInstance = new PotentialPlugin();
  } catch (err) {
    result.error = err;
    return result;
  }

  // check the assumed Plugin has an array of extension descriptors
  if (!Array.isArray(potentialPluginInstance.extensionDescriptors)) {
    result.error = new Error(
      `Plugin from ${url} does not provide an extensionDescriptors array`,
    );
    return result;
  }

  // At this point assume it is a valid plugin and then disprove this
  result.isValidPlugin = true;

  for (
    const potentialExtensionDescriptor of potentialPluginInstance
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
  result.instance = potentialPluginInstance;
  return result;
}
