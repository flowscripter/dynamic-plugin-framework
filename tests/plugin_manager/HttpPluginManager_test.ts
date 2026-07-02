import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import HttpPluginManager from "../../src/plugin_manager/HttpPluginManager.ts";
import LocalFolderPluginRepository from "../../src/plugin_manager/plugin_repository/LocalFolderPluginRepository.ts";
import type SearchQuery from "../../src/api/plugin_repository/SearchQuery.ts";
import type VersionedPluginDescriptor from "../../src/api/plugin_repository/VersionedPluginDescriptor.ts";
import type HttpManifestPluginRepository from "../../src/plugin_manager/plugin_repository/HttpManifestPluginRepository.ts";
import type ExtensionEntry from "../../src/api/plugin_repository/ExtensionEntry.ts";
import type ExtensionDescriptor from "../../src/api/plugin/ExtensionDescriptor.ts";

const MANIFEST_FILE = "manifest.json";

function makeDescriptor(
  pluginId: string,
  version = "1.0.0",
  name?: string,
): VersionedPluginDescriptor {
  return {
    pluginId,
    extensionPoints: ["ep1"],
    scope: undefined,
    name: name ?? pluginId,
    version,
    dependencies: undefined,
  };
}

class MockRemote {
  constructor(public readonly descriptors: VersionedPluginDescriptor[]) {}

  async *search(_query: SearchQuery): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    yield* this.descriptors;
  }

  async *getPlugins(): AsyncIterable<Readonly<VersionedPluginDescriptor>> {
    yield* this.descriptors;
  }

  async getPlugin(pluginId: string): Promise<Readonly<VersionedPluginDescriptor> | undefined> {
    return this.descriptors.find((d) => (d.scope ? `${d.scope}/${d.name}` : d.name) === pluginId);
  }

  scanForExtensions(_ep: string): AsyncIterable<Readonly<ExtensionEntry>> {
    return (async function* () {})();
  }

  getExtensionDescriptorFromExtensionEntry(
    _e: ExtensionEntry,
  ): Promise<Readonly<ExtensionDescriptor>> {
    return Promise.reject(new Error("not supported"));
  }
}

class MockLocal {
  async *getPlugins(): AsyncIterable<Readonly<VersionedPluginDescriptor>> {}

  scanForExtensions(_ep: string): AsyncIterable<Readonly<ExtensionEntry>> {
    return (async function* () {})();
  }

  getExtensionDescriptorFromExtensionEntry(
    _e: ExtensionEntry,
  ): Promise<Readonly<ExtensionDescriptor>> {
    return Promise.reject(new Error("not supported"));
  }
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "http-manager-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("HttpPluginManager", () => {
  describe("search()", () => {
    it("yields descriptors from a single remote", async () => {
      const remote = new MockRemote([makeDescriptor("plugin-a"), makeDescriptor("plugin-b")]);
      const manager = new HttpPluginManager(
        [remote] as unknown as HttpManifestPluginRepository[],
        new MockLocal() as unknown as LocalFolderPluginRepository,
      );

      const results: VersionedPluginDescriptor[] = [];
      for await (const d of manager.search({ text: "plugin" })) {
        results.push(d as VersionedPluginDescriptor);
      }

      expect(results.length).toEqual(2);
      expect(results[0].pluginId).toEqual("plugin-a");
      expect(results[1].pluginId).toEqual("plugin-b");
    });

    it("yields descriptors from multiple remotes in order", async () => {
      const remote1 = new MockRemote([makeDescriptor("plugin-a")]);
      const remote2 = new MockRemote([makeDescriptor("plugin-b"), makeDescriptor("plugin-c")]);
      const manager = new HttpPluginManager(
        [remote1, remote2] as unknown as HttpManifestPluginRepository[],
        new MockLocal() as unknown as LocalFolderPluginRepository,
      );

      const results: VersionedPluginDescriptor[] = [];
      for await (const d of manager.search({})) {
        results.push(d as VersionedPluginDescriptor);
      }

      expect(results.length).toEqual(3);
      expect(results[0].pluginId).toEqual("plugin-a");
      expect(results[1].pluginId).toEqual("plugin-b");
      expect(results[2].pluginId).toEqual("plugin-c");
    });
  });

  describe("install()", () => {
    it("throws when remotes array is empty", async () => {
      const manager = new HttpPluginManager(
        [] as unknown as HttpManifestPluginRepository[],
        new MockLocal() as unknown as LocalFolderPluginRepository,
      );

      expect(manager.install(makeDescriptor("plugin-a"))).rejects.toThrow(
        "not found in any configured remote repository",
      );
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
      const manager = new HttpPluginManager([] as unknown as HttpManifestPluginRepository[], repo);

      await expect(manager.uninstall("plugin-b")).rejects.toThrow("plugin-a");
    });

    it("throws when plugin is not installed", async () => {
      await Bun.write(path.join(tmpDir, MANIFEST_FILE), JSON.stringify([]));

      const repo = new LocalFolderPluginRepository(tmpDir, MANIFEST_FILE);
      const manager = new HttpPluginManager([] as unknown as HttpManifestPluginRepository[], repo);

      await expect(manager.uninstall("not-installed")).rejects.toThrow("not installed");
    });
  });

  describe("checkForUpdates()", () => {
    it("yields entries where remote has a higher version", async () => {
      const local = new MockRemote([makeDescriptor("my-plugin", "1.0.0", "my-plugin")]);
      const remote = new MockRemote([makeDescriptor("my-plugin", "2.0.0", "my-plugin")]);

      const manager = new HttpPluginManager(
        [remote] as unknown as HttpManifestPluginRepository[],
        local as unknown as LocalFolderPluginRepository,
      );
      const updates: { availableVersion: string }[] = [];
      for await (const u of manager.checkForUpdates()) {
        updates.push(u);
      }

      expect(updates.length).toEqual(1);
      expect(updates[0].availableVersion).toEqual("2.0.0");
    });

    it("does not yield entries where local version is current", async () => {
      const local = new MockRemote([makeDescriptor("my-plugin", "2.0.0", "my-plugin")]);
      const remote = new MockRemote([makeDescriptor("my-plugin", "2.0.0", "my-plugin")]);

      const manager = new HttpPluginManager(
        [remote] as unknown as HttpManifestPluginRepository[],
        local as unknown as LocalFolderPluginRepository,
      );
      const updates: unknown[] = [];
      for await (const u of manager.checkForUpdates()) {
        updates.push(u);
      }
      expect(updates.length).toEqual(0);
    });

    it("does not yield entries where local version is newer", async () => {
      const local = new MockRemote([makeDescriptor("my-plugin", "3.0.0", "my-plugin")]);
      const remote = new MockRemote([makeDescriptor("my-plugin", "2.0.0", "my-plugin")]);

      const manager = new HttpPluginManager(
        [remote] as unknown as HttpManifestPluginRepository[],
        local as unknown as LocalFolderPluginRepository,
      );
      const updates: unknown[] = [];
      for await (const u of manager.checkForUpdates()) {
        updates.push(u);
      }
      expect(updates.length).toEqual(0);
    });

    it("skips plugins in local that are not in remote", async () => {
      const local = new MockRemote([makeDescriptor("local-only", "1.0.0", "local-only")]);
      const remote = new MockRemote([makeDescriptor("remote-only", "2.0.0", "remote-only")]);

      const manager = new HttpPluginManager(
        [remote] as unknown as HttpManifestPluginRepository[],
        local as unknown as LocalFolderPluginRepository,
      );
      const updates: unknown[] = [];
      for await (const u of manager.checkForUpdates()) {
        updates.push(u);
      }
      expect(updates.length).toEqual(0);
    });

    it("handles multiple plugins with mixed update states", async () => {
      const local = new MockRemote([
        makeDescriptor("plugin-a", "1.0.0", "plugin-a"),
        makeDescriptor("plugin-b", "2.0.0", "plugin-b"),
        makeDescriptor("plugin-c", "3.0.0", "plugin-c"),
      ]);
      const remote = new MockRemote([
        makeDescriptor("plugin-a", "1.5.0", "plugin-a"),
        makeDescriptor("plugin-b", "2.0.0", "plugin-b"),
        makeDescriptor("plugin-c", "2.9.9", "plugin-c"),
      ]);

      const manager = new HttpPluginManager(
        [remote] as unknown as HttpManifestPluginRepository[],
        local as unknown as LocalFolderPluginRepository,
      );
      const updates: { descriptor: Readonly<VersionedPluginDescriptor> }[] = [];
      for await (const u of manager.checkForUpdates()) {
        updates.push(u);
      }

      expect(updates.length).toEqual(1);
      expect(updates[0].descriptor.name).toEqual("plugin-a");
    });

    it("throws when no remotes configured and no explicit remote given", async () => {
      const manager = new HttpPluginManager(
        [] as unknown as HttpManifestPluginRepository[],
        new MockLocal() as unknown as LocalFolderPluginRepository,
      );
      expect(() => manager.checkForUpdates()).toThrow("No remote repository configured");
    });
  });

  describe("registerExtensions() / getRegisteredExtensions()", () => {
    it("returns empty array for unregistered extension point after registerExtensions", async () => {
      const manager = new HttpPluginManager(
        [] as unknown as HttpManifestPluginRepository[],
        new MockLocal() as unknown as LocalFolderPluginRepository,
      );

      await manager.registerExtensions("ep1");
      const results = await manager.getRegisteredExtensions("ep1");
      expect(results.length).toEqual(0);
    });

    it("returns empty array for never-registered extension point", async () => {
      const manager = new HttpPluginManager(
        [] as unknown as HttpManifestPluginRepository[],
        new MockLocal() as unknown as LocalFolderPluginRepository,
      );

      const results = await manager.getRegisteredExtensions("ep-unknown");
      expect(results.length).toEqual(0);
    });
  });
});
