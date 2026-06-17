import path from "node:path";
import semver from "semver";
import type VersionedPluginInstaller from "../../api/plugin_installer/VersionedPluginInstaller.ts";
import type VersionedPluginDescriptor from "../../api/plugin_repository/VersionedPluginDescriptor.ts";
import type VersionedPluginRepository from "../../api/plugin_repository/VersionedPluginRepository.ts";
import type NpmPluginRepository from "../plugin_repository/NpmPluginRepository.ts";
import { checkForUpdates } from "./checkForUpdates.ts";

export default class NpmPluginInstaller implements VersionedPluginInstaller {
  private readonly installCommand: string;

  public constructor({ installCommand = "bun add" }: { installCommand?: string } = {}) {
    this.installCommand = installCommand;
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
    source: VersionedPluginRepository,
    target: VersionedPluginRepository,
    options?: { includeDependencies?: boolean },
  ): Promise<void> {
    const tgt = target as NpmPluginRepository;
    await this.installOne(descriptor, source, tgt, options?.includeDependencies ?? false);
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

  public async uninstall(pluginId: string, target: VersionedPluginRepository): Promise<void> {
    const tgt = target as NpmPluginRepository;

    // check for dependents
    for await (const plugin of tgt.getPlugins()) {
      if (plugin.pluginId === pluginId) continue;
      if (!plugin.dependencies) continue;
      for (const dep of plugin.dependencies) {
        const depId = dep.scope ? `${dep.scope}/${dep.name}` : dep.name;
        if (depId === pluginId || plugin.pluginId === pluginId) continue;
        // match by pluginId (package name) directly
        if (depId === pluginId) {
          throw new Error(`Cannot uninstall ${pluginId}: plugin ${plugin.pluginId} depends on it`);
        }
      }
    }

    const cwd = path.dirname(tgt.nodeModulesPath);
    // derive remove command from install command (bun add -> bun remove, npm install -> npm uninstall)
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

  public checkForUpdates(
    local: VersionedPluginRepository,
    remote: VersionedPluginRepository,
  ): AsyncIterable<{ descriptor: Readonly<VersionedPluginDescriptor>; availableVersion: string }> {
    return checkForUpdates(local, remote);
  }
}
