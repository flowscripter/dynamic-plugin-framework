import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import HttpPluginInstaller from "../../../src/plugin_manager/plugin_installer/HttpPluginInstaller.ts";
import LocalFolderPluginRepository from "../../../src/plugin_manager/plugin_repository/LocalFolderPluginRepository.ts";
import type VersionedPluginDescriptor from "../../../src/api/plugin_repository/VersionedPluginDescriptor.ts";
import type VersionedPluginRepository from "../../../src/api/plugin_repository/VersionedPluginRepository.ts";
import type ExtensionDescriptor from "../../../src/api/plugin/ExtensionDescriptor.ts";
import type ExtensionEntry from "../../../src/api/plugin_repository/ExtensionEntry.ts";

const MANIFEST_FILE = "manifest.json";

function makeDescriptor(name: string, version: string, scope?: string): VersionedPluginDescriptor {
  return {
    pluginId: `https://example.com/${name}.js`,
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

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "http-installer-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("HttpPluginInstaller Tests", () => {
  describe("checkForUpdates()", () => {
    it("yields entries where remote has a higher version", async () => {
      const local = makeRepo([makeDescriptor("my-plugin", "1.0.0")]);
      const remote = makeRepo([makeDescriptor("my-plugin", "2.0.0")]);

      const installer = new HttpPluginInstaller();
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

      const installer = new HttpPluginInstaller();
      const updates: unknown[] = [];
      for await (const u of installer.checkForUpdates(local, remote)) {
        updates.push(u);
      }
      expect(updates.length).toEqual(0);
    });

    it("does not yield entries where local version is newer", async () => {
      const local = makeRepo([makeDescriptor("my-plugin", "3.0.0")]);
      const remote = makeRepo([makeDescriptor("my-plugin", "2.0.0")]);

      const installer = new HttpPluginInstaller();
      const updates: unknown[] = [];
      for await (const u of installer.checkForUpdates(local, remote)) {
        updates.push(u);
      }
      expect(updates.length).toEqual(0);
    });

    it("skips plugins in local that are not in remote", async () => {
      const local = makeRepo([makeDescriptor("local-only", "1.0.0")]);
      const remote = makeRepo([makeDescriptor("remote-only", "2.0.0")]);

      const installer = new HttpPluginInstaller();
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
        makeDescriptor("plugin-c", "3.0.0"),
      ]);
      const remote = makeRepo([
        makeDescriptor("plugin-a", "1.5.0"),
        makeDescriptor("plugin-b", "2.0.0"),
        makeDescriptor("plugin-c", "2.9.9"),
      ]);

      const installer = new HttpPluginInstaller();
      const updates: { descriptor: Readonly<VersionedPluginDescriptor> }[] = [];
      for await (const u of installer.checkForUpdates(local, remote)) {
        updates.push(u);
      }

      expect(updates.length).toEqual(1);
      expect(updates[0].descriptor.name).toEqual("plugin-a");
    });
  });

  describe("uninstall()", () => {
    it("throws when another plugin depends on the target plugin", async () => {
      const manifest = [
        {
          pluginId: "plugin-a",
          bundlePath: "/some/path/a.js",
          extensionPoints: ["ep1"],
          name: "plugin-a",
          version: "1.0.0",
          dependencies: [{ name: "plugin-b", versionRange: "^1.0.0" }],
        },
        {
          pluginId: "plugin-b",
          bundlePath: "/some/path/b.js",
          extensionPoints: ["ep1"],
          name: "plugin-b",
          version: "1.0.0",
        },
      ];
      await Bun.write(path.join(tmpDir, MANIFEST_FILE), JSON.stringify(manifest));

      const repo = new LocalFolderPluginRepository(tmpDir, MANIFEST_FILE);
      const installer = new HttpPluginInstaller();

      await expect(installer.uninstall("plugin-b", repo)).rejects.toThrow("plugin-a");
    });

    it("throws when plugin is not installed", async () => {
      await Bun.write(path.join(tmpDir, MANIFEST_FILE), JSON.stringify([]));

      const repo = new LocalFolderPluginRepository(tmpDir, MANIFEST_FILE);
      const installer = new HttpPluginInstaller();

      await expect(installer.uninstall("not-installed", repo)).rejects.toThrow("not installed");
    });
  });
});
