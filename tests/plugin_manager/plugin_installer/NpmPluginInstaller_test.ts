import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import NpmPluginInstaller from "../../../src/plugin_manager/plugin_installer/NpmPluginInstaller.ts";
import NpmPluginRepository from "../../../src/plugin_manager/plugin_repository/NpmPluginRepository.ts";
import type VersionedPluginDescriptor from "../../../src/api/plugin_repository/VersionedPluginDescriptor.ts";
import type VersionedPluginRepository from "../../../src/api/plugin_repository/VersionedPluginRepository.ts";
import type ExtensionDescriptor from "../../../src/api/plugin/ExtensionDescriptor.ts";
import type ExtensionEntry from "../../../src/api/plugin_repository/ExtensionEntry.ts";

const NAMESPACE = "mypluginframework";

function makeDescriptor(name: string, version: string, scope?: string): VersionedPluginDescriptor {
  return {
    pluginId: scope ? `${scope}/${name}` : name,
    extensionPoints: ["ep1"],
    name,
    version,
    scope,
  };
}

function makeRepo(descriptors: VersionedPluginDescriptor[]): VersionedPluginRepository {
  return {
    async *getPlugins(): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
      for (const d of descriptors) yield d;
    },
    async *scanForExtensions(_extensionPoint: string): AsyncIterable<Readonly<ExtensionEntry>> {
      // not needed for these tests
    },
    getExtensionDescriptorFromExtensionEntry(
      _entry: ExtensionEntry,
    ): Promise<Readonly<ExtensionDescriptor>> {
      return Promise.reject(new Error("not implemented"));
    },
  };
}

let nodeModulesDir: string;

beforeEach(async () => {
  const base = await mkdtemp(path.join(tmpdir(), "npm-installer-test-"));
  nodeModulesDir = path.join(base, "node_modules");
  await mkdir(nodeModulesDir, { recursive: true });
});

afterEach(async () => {
  await rm(path.dirname(nodeModulesDir), { recursive: true, force: true });
});

describe("NpmPluginInstaller Tests", () => {
  describe("checkForUpdates()", () => {
    it("yields entries where remote has a higher version", async () => {
      const local = makeRepo([makeDescriptor("my-plugin", "1.0.0")]);
      const remote = makeRepo([makeDescriptor("my-plugin", "2.0.0")]);

      const installer = new NpmPluginInstaller();
      const updates: { availableVersion: string }[] = [];
      for await (const u of installer.checkForUpdates(local, remote)) {
        updates.push(u);
      }

      expect(updates.length).toEqual(1);
      expect(updates[0].availableVersion).toEqual("2.0.0");
    });

    it("does not yield entries where local version is current", async () => {
      const local = makeRepo([makeDescriptor("my-plugin", "2.0.0")]);
      const remote = makeRepo([makeDescriptor("my-plugin", "2.0.0")]);

      const installer = new NpmPluginInstaller();
      const updates: unknown[] = [];
      for await (const u of installer.checkForUpdates(local, remote)) {
        updates.push(u);
      }
      expect(updates.length).toEqual(0);
    });

    it("does not yield entries where local version is newer", async () => {
      const local = makeRepo([makeDescriptor("my-plugin", "3.0.0")]);
      const remote = makeRepo([makeDescriptor("my-plugin", "2.0.0")]);

      const installer = new NpmPluginInstaller();
      const updates: unknown[] = [];
      for await (const u of installer.checkForUpdates(local, remote)) {
        updates.push(u);
      }
      expect(updates.length).toEqual(0);
    });

    it("skips plugins in local that are not in remote", async () => {
      const local = makeRepo([makeDescriptor("local-only", "1.0.0")]);
      const remote = makeRepo([makeDescriptor("remote-only", "2.0.0")]);

      const installer = new NpmPluginInstaller();
      const updates: unknown[] = [];
      for await (const u of installer.checkForUpdates(local, remote)) {
        updates.push(u);
      }
      expect(updates.length).toEqual(0);
    });

    it("handles multiple plugins with mixed update states", async () => {
      const local = makeRepo([
        makeDescriptor("plugin-a", "1.0.0"),
        makeDescriptor("plugin-b", "2.0.0"),
      ]);
      const remote = makeRepo([
        makeDescriptor("plugin-a", "1.5.0"),
        makeDescriptor("plugin-b", "1.9.9"),
      ]);

      const installer = new NpmPluginInstaller();
      const updates: { descriptor: Readonly<VersionedPluginDescriptor> }[] = [];
      for await (const u of installer.checkForUpdates(local, remote)) {
        updates.push(u);
      }

      expect(updates.length).toEqual(1);
      expect(updates[0].descriptor.name).toEqual("plugin-a");
    });
  });

  describe("uninstall()", () => {
    it("throws when the remove command fails", async () => {
      await mkdir(path.join(nodeModulesDir, "my-plugin"), { recursive: true });
      await Bun.write(
        path.join(nodeModulesDir, "my-plugin", "package.json"),
        JSON.stringify({
          name: "my-plugin",
          version: "1.0.0",
          [NAMESPACE]: { extensionPoints: ["ep1"] },
        }),
      );

      const repo = new NpmPluginRepository(nodeModulesDir, NAMESPACE);
      const installer = new NpmPluginInstaller();

      // bun remove in a dir without package.json will fail with non-zero exit
      await expect(installer.uninstall("my-plugin", repo)).rejects.toThrow();
    });
  });
});
