import { isBunRuntime } from "./Runtime.ts";

/**
 * A module supplied by the host application to plugins.
 */
export interface SharedModule {
  /**
   * Version of the module, checked against {@link Plugin.sharedModules} ranges.
   */
  version?: string;

  /**
   * The module namespace (for example `import * as ns from "pkg"`) handed to plugins which import the specifier.
   */
  exports: object;
}

const modules = new Map<string, SharedModule>();
const versions = new Map<string, string>();

/**
 * Register modules supplied by the host so that plugins which import the same specifiers
 * (for example because they were built with `--external`) receive the host's single copy
 * rather than resolving their own.
 *
 * Registration is process-global (it uses Bun virtual modules) and must happen before the first
 * plugin which imports the specifier is loaded. Matching is exact: a subpath such as `pkg/sub`
 * must be registered separately from `pkg`. The registered value is a snapshot of the
 * namespace object.
 *
 * Registering the same specifier again with the same `exports` object is a no-op.
 *
 * @throws *Error* if not running under Bun (in a browser use an import map together with {@link describeSharedModules}).
 * @throws *Error* if a specifier is already registered with a different `exports` object.
 */
export function registerSharedModules(registrations: Record<string, SharedModule>): void {
  if (!isBunRuntime()) {
    throw new Error("registerSharedModules requires Bun; in a browser use an import map");
  }
  const toRegister: [string, SharedModule][] = [];
  for (const [specifier, shared] of Object.entries(registrations)) {
    const existing = modules.get(specifier);
    if (existing === undefined) {
      toRegister.push([specifier, shared]);
    } else if (existing.exports !== shared.exports) {
      throw new Error(
        `Shared module '${specifier}' is already registered with a different exports object`,
      );
    }
  }
  if (toRegister.length === 0) {
    return;
  }
  Bun.plugin({
    name: "flowscripter-shared-modules",
    setup(build) {
      for (const [specifier, shared] of toRegister) {
        modules.set(specifier, shared);
        if (shared.version !== undefined) {
          versions.set(specifier, shared.version);
        }
        build.module(specifier, () => ({
          exports: shared.exports as Record<string, unknown>,
          loader: "object",
        }));
      }
    },
  });
}

/**
 * Declare the versions of modules supplied to plugins by other means (for example an import map
 * in a browser) so that {@link Plugin.sharedModules} ranges can be checked. Works on any runtime.
 */
export function describeSharedModules(moduleVersions: Record<string, string>): void {
  for (const [specifier, version] of Object.entries(moduleVersions)) {
    versions.set(specifier, version);
  }
}

/**
 * @returns `true` if the specifier has been registered via {@link registerSharedModules}.
 */
export function isSharedModuleRegistered(specifier: string): boolean {
  return modules.has(specifier);
}

/**
 * @returns the state of the specifier: `undefined` if the host has not declared it, otherwise
 *   an object with the declared version (which may itself be `undefined`).
 */
export function getSharedModule(specifier: string): { version: string | undefined } | undefined {
  if (!modules.has(specifier) && !versions.has(specifier)) {
    return undefined;
  }
  return { version: versions.get(specifier) };
}
