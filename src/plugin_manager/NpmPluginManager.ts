import path from "node:path";
import process from "node:process";
import { mkdir, rm } from "node:fs/promises";
import semver from "semver";
import BaseMarketplacePluginManager from "./BaseMarketplacePluginManager.ts";
import type NpmjsPluginRepository from "./plugin_repository/NpmjsPluginRepository.ts";
import type NpmPluginRepository from "./plugin_repository/NpmPluginRepository.ts";
import type PluginManager from "../api/plugin_manager/PluginManager.ts";
import type VersionedPluginDescriptor from "../api/plugin_repository/VersionedPluginDescriptor.ts";
import type VersionedPluginRepository from "../api/plugin_repository/VersionedPluginRepository.ts";
import type SpawnCapable from "../api/spawn/SpawnCapable.ts";
import type SpawnInterface from "../api/spawn/SpawnInterface.ts";

/**
 * On Windows, batch-file shims (e.g. `npm.cmd`, `bun.cmd`) cannot be launched directly via
 * `CreateProcess` - they must be run through `cmd.exe /c`. Resolve the command through the shell
 * in that case; leave it untouched on other platforms.
 */
export function resolveForPlatform(args: string[]): string[] {
  if (process.platform !== "win32") {
    return args;
  }
  const [bin, ...rest] = args;
  if (bin === undefined) {
    return args;
  }
  const resolved = Bun.which(bin) ?? bin;
  if (!/\.(cmd|bat)$/i.test(resolved)) {
    return [resolved, ...rest];
  }
  return ["cmd.exe", "/d", "/s", "/c", resolved, ...rest];
}

/**
 * {@link BaseMarketplacePluginManager} for the npm ecosystem.
 *
 * Combines one or more {@link NpmjsPluginRepository} remotes with a local
 * {@link NpmPluginRepository} (backed by `node_modules`). Plugins are installed and
 * removed by shelling out to bun/npm, or via an injected {@link SpawnInterface} if
 * {@link setSpawn} has been called.
 */
export default class NpmPluginManager
  extends BaseMarketplacePluginManager<NpmjsPluginRepository, NpmPluginRepository>
  implements SpawnCapable
{
  private readonly installCommand: string;
  private spawn: SpawnInterface | undefined;

  /**
   * @param remotes marketplace repositories used for search and as install sources.
   * @param local repository used to load installed plugins, backed by `node_modules`.
   * @param options.installCommand optional install command (e.g. `"npm install"`). If not
   * specified, `"bun add"` is used if `bun` is on `PATH`, falling back to `"npm install"` if
   * `npm` is on `PATH` instead. Throws if neither is found and no explicit command is given.
   * @param options.pluginManager optional {@link PluginManager} to delegate to; see
   * {@link BaseMarketplacePluginManager}.
   */
  public constructor(
    remotes: NpmjsPluginRepository[],
    local: NpmPluginRepository,
    {
      installCommand,
      pluginManager,
    }: { installCommand?: string; pluginManager?: PluginManager } = {},
  ) {
    super(remotes, local, pluginManager);
    this.installCommand = installCommand ?? NpmPluginManager.resolveDefaultInstallCommand();
    const binary = this.installCommand.split(" ")[0]!;
    if (!Bun.which(binary)) {
      throw new Error(
        `Install command binary '${binary}' not found on PATH; cannot install plugins`,
      );
    }
  }

  private static resolveDefaultInstallCommand(): string {
    if (Bun.which("bun")) return "bun add";
    if (Bun.which("npm")) return "npm install";
    throw new Error(
      "Neither 'bun' nor 'npm' found on PATH; specify installCommand explicitly to use a different package manager",
    );
  }

  public setSpawn(spawn: SpawnInterface): void {
    this.spawn = spawn;
  }

  private async runCommand(args: string[], cwd: string): Promise<void> {
    if (this.spawn) {
      const result = await this.spawn.spawn(args, { cwd });
      if (!result.ok) {
        if (result.error) {
          throw new Error(`Command '${args.join(" ")}' failed to launch: ${result.error.message}`);
        }
        throw new Error(`Command '${args.join(" ")}' failed with exit code ${result.exitCode}`);
      }
      return;
    }

    const proc = Bun.spawn(resolveForPlatform(args), {
      cwd,
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Command '${args.join(" ")}' failed with exit code ${exitCode}`);
    }
  }

  public async install(
    descriptor: Readonly<VersionedPluginDescriptor>,
    options?: { includeDependencies?: boolean },
  ): Promise<void> {
    let source: VersionedPluginRepository | undefined;
    for (const remote of this.remotes) {
      for await (const d of remote.getPlugins()) {
        if (d.pluginId === descriptor.pluginId) {
          source = remote;
          break;
        }
      }
      if (source) break;
    }
    if (!source) {
      if (this.remotes.length === 0) {
        throw new Error(
          `Plugin ${descriptor.pluginId} not found in any configured remote repository`,
        );
      }
      source = this.remotes[0]!;
    }
    await this.installOne(descriptor, source, this.local, options?.includeDependencies ?? false);
  }

  private async installOne(
    descriptor: Readonly<VersionedPluginDescriptor>,
    source: VersionedPluginRepository,
    target: NpmPluginRepository,
    includeDependencies: boolean,
  ): Promise<void> {
    if (includeDependencies && descriptor.dependencies) {
      for (const dep of descriptor.dependencies) {
        const depId = dep.scope ? `${dep.scope}/${dep.name}` : dep.name;

        let satisfied = false;
        for await (const installed of target.getPlugins()) {
          const installedId = installed.scope
            ? `${installed.scope}/${installed.name}`
            : installed.name;
          if (installedId === depId && semver.satisfies(installed.version, dep.versionRange)) {
            satisfied = true;
            break;
          }
        }
        if (satisfied) continue;

        let found: Readonly<VersionedPluginDescriptor> | undefined;
        for await (const remote of source.getPlugins()) {
          const remoteId = remote.scope ? `${remote.scope}/${remote.name}` : remote.name;
          if (remoteId === depId && semver.satisfies(remote.version, dep.versionRange)) {
            found = remote;
            break;
          }
        }
        if (!found) {
          throw new Error(`Dependency ${depId}@${dep.versionRange} not found in source repository`);
        }
        await this.installOne(found, source, target, includeDependencies);
      }
    }

    const cwd = path.dirname(target.nodeModulesPath);
    await mkdir(cwd, { recursive: true });
    const cmdParts = [...this.installCommand.split(" "), descriptor.pluginId];
    await this.runCommand(cmdParts, cwd);
    await this.validatePluginBundled(descriptor.pluginId, target.nodeModulesPath, cwd);
  }

  private async validatePluginBundled(
    pluginId: string,
    nodeModulesPath: string,
    cwd: string,
  ): Promise<void> {
    const pluginDir = path.join(nodeModulesPath, pluginId);
    const pkgFile = Bun.file(path.join(pluginDir, "package.json"));
    if (!(await pkgFile.exists())) return;

    const pkg = (await pkgFile.json()) as Record<string, unknown>;
    const exports = pkg["exports"] as Record<string, unknown> | undefined;
    const rootExport = exports?.["."] as Record<string, string> | undefined;

    const candidates = [rootExport?.["default"], pkg["main"] as string | undefined];

    for (const rel of candidates) {
      if (!rel || typeof rel !== "string") continue;
      if (await Bun.file(path.join(pluginDir, rel)).exists()) return;
    }

    // No bundled entry found — uninstall and surface a clear error.
    let removeCmd: string;
    if (this.installCommand.startsWith("bun")) {
      removeCmd = "bun remove";
    } else if (this.installCommand.startsWith("npm")) {
      removeCmd = "npm uninstall";
    } else {
      removeCmd = this.installCommand.replace(/add|install/, "remove");
    }
    await this.runCommand([...removeCmd.split(" "), pluginId], cwd);
    throw new Error(
      `Plugin ${pluginId} does not ship a pre-built bundle (no "default" export entry found). Only bundled plugins are supported.`,
    );
  }

  public async uninstall(pluginId: string): Promise<void> {
    for await (const plugin of this.local.getPlugins()) {
      if (plugin.pluginId === pluginId) continue;
      if (!plugin.dependencies) continue;
      for (const dep of plugin.dependencies) {
        const depId = dep.scope ? `${dep.scope}/${dep.name}` : dep.name;
        if (depId === pluginId) {
          throw new Error(`Cannot uninstall ${pluginId}: plugin ${plugin.pluginId} depends on it`);
        }
      }
    }

    const cwd = path.dirname(this.local.nodeModulesPath);
    await mkdir(cwd, { recursive: true });
    let removeCmd: string;
    if (this.installCommand.startsWith("bun")) {
      removeCmd = "bun remove";
    } else if (this.installCommand.startsWith("npm")) {
      removeCmd = "npm uninstall";
    } else {
      removeCmd = this.installCommand.replace(/add|install/, "remove");
    }
    const cmdParts = [...removeCmd.split(" "), pluginId];
    await this.runCommand(cmdParts, cwd);

    if (this.installCommand.startsWith("bun")) {
      // bun does not prune node_modules of packages orphaned by removal, leaving stale
      // transitive dependencies on disk even though the lockfile is correct.
      // See https://github.com/oven-sh/bun/issues/3605
      if (path.basename(this.local.nodeModulesPath) === "node_modules") {
        await rm(this.local.nodeModulesPath, { recursive: true, force: true });
        await this.runCommand(["bun", "install"], cwd);
      }
    }
  }
}
