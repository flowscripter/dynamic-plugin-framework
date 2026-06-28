import path from "node:path";
import semver from "semver";
import BaseMarketplacePluginManager from "./BaseMarketplacePluginManager.ts";
import type NpmjsPluginRepository from "./plugin_repository/NpmjsPluginRepository.ts";
import type NpmPluginRepository from "./plugin_repository/NpmPluginRepository.ts";
import type VersionedPluginDescriptor from "../api/plugin_repository/VersionedPluginDescriptor.ts";
import type VersionedPluginRepository from "../api/plugin_repository/VersionedPluginRepository.ts";

/**
 * {@link BaseMarketplacePluginManager} for the npm ecosystem.
 *
 * Combines one or more {@link NpmjsPluginRepository} remotes with a local
 * {@link NpmPluginRepository} (backed by `node_modules`). Plugins are installed and
 * removed by shelling out to bun/npm.
 */
export default class NpmPluginManager extends BaseMarketplacePluginManager<
  NpmjsPluginRepository,
  NpmPluginRepository
> {
  private readonly installCommand: string;

  public constructor(
    remotes: NpmjsPluginRepository[],
    local: NpmPluginRepository,
    { installCommand = "bun add" }: { installCommand?: string } = {},
  ) {
    super(remotes, local);
    this.installCommand = installCommand;
    const binary = installCommand.split(" ")[0]!;
    if (!Bun.which(binary)) {
      throw new Error(
        `Install command binary '${binary}' not found on PATH; cannot install plugins`,
      );
    }
  }

  private async runCommand(args: string[], cwd: string): Promise<void> {
    const proc = Bun.spawn(args, { cwd, stdout: "inherit", stderr: "inherit" });
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
    const cmdParts = [...this.installCommand.split(" "), descriptor.pluginId];
    await this.runCommand(cmdParts, cwd);
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
  }
}
