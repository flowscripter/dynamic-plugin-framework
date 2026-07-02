import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import NpmPluginManager from "../../src/plugin_manager/NpmPluginManager.ts";
import NpmPluginRepository from "../../src/plugin_manager/plugin_repository/NpmPluginRepository.ts";
import type SearchQuery from "../../src/api/plugin_repository/SearchQuery.ts";
import type VersionedPluginDescriptor from "../../src/api/plugin_repository/VersionedPluginDescriptor.ts";
import type NpmjsPluginRepository from "../../src/plugin_manager/plugin_repository/NpmjsPluginRepository.ts";
import type ExtensionEntry from "../../src/api/plugin_repository/ExtensionEntry.ts";
import type ExtensionDescriptor from "../../src/api/plugin/ExtensionDescriptor.ts";
import type PluginManager from "../../src/api/plugin_manager/PluginManager.ts";
import type ExtensionInfo from "../../src/api/plugin_manager/ExtensionInfo.ts";

const NAMESPACE = "mypluginframework";

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
    return this.descriptors.find(
      (d) => (d.scope ? `${d.scope}/${d.name}` : d.name) === pluginId,
    );
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

let nodeModulesDir: string;

beforeEach(async () => {
  const base = await mkdtemp(path.join(tmpdir(), "npm-manager-test-"));
  nodeModulesDir = path.join(base, "node_modules");
  await mkdir(nodeModulesDir, { recursive: true });
});

afterEach(async () => {
  await rm(path.dirname(nodeModulesDir), { recursive: true, force: true });
});

describe("NpmPluginManager", () => {
  describe("search()", () => {
    it("yields descriptors from a single remote", async () => {
      const remote = new MockRemote([makeDescriptor("plugin-a"), makeDescriptor("plugin-b")]);
      const manager = new NpmPluginManager(
        [remote] as unknown as NpmjsPluginRepository[],
        new MockLocal() as unknown as NpmPluginRepository,
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
      const manager = new NpmPluginManager(
        [remote1, remote2] as unknown as NpmjsPluginRepository[],
        new MockLocal() as unknown as NpmPluginRepository,
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
      const manager = new NpmPluginManager(
        [] as unknown as NpmjsPluginRepository[],
        new MockLocal() as unknown as NpmPluginRepository,
      );

      expect(manager.install(makeDescriptor("plugin-a"))).rejects.toThrow(
        "not found in any configured remote repository",
      );
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
      const manager = new NpmPluginManager([] as unknown as NpmjsPluginRepository[], repo);

      // bun remove in a dir without package.json will fail with non-zero exit
      await expect(manager.uninstall("my-plugin")).rejects.toThrow();
    });
  });

  describe("checkForUpdates()", () => {
    it("yields entries where remote has a higher version", async () => {
      const local = new MockRemote([makeDescriptor("my-plugin", "1.0.0", "my-plugin")]);
      const remote = new MockRemote([makeDescriptor("my-plugin", "2.0.0", "my-plugin")]);

      const manager = new NpmPluginManager(
        [remote] as unknown as NpmjsPluginRepository[],
        local as unknown as NpmPluginRepository,
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

      const manager = new NpmPluginManager(
        [remote] as unknown as NpmjsPluginRepository[],
        local as unknown as NpmPluginRepository,
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

      const manager = new NpmPluginManager(
        [remote] as unknown as NpmjsPluginRepository[],
        local as unknown as NpmPluginRepository,
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

      const manager = new NpmPluginManager(
        [remote] as unknown as NpmjsPluginRepository[],
        local as unknown as NpmPluginRepository,
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
      ]);
      const remote = new MockRemote([
        makeDescriptor("plugin-a", "1.5.0", "plugin-a"),
        makeDescriptor("plugin-b", "1.9.9", "plugin-b"),
      ]);

      const manager = new NpmPluginManager(
        [remote] as unknown as NpmjsPluginRepository[],
        local as unknown as NpmPluginRepository,
      );
      const updates: { descriptor: Readonly<VersionedPluginDescriptor> }[] = [];
      for await (const u of manager.checkForUpdates()) {
        updates.push(u);
      }

      expect(updates.length).toEqual(1);
      expect(updates[0].descriptor.name).toEqual("plugin-a");
    });

    it("throws when no remotes configured and no explicit remote given", async () => {
      const manager = new NpmPluginManager(
        [] as unknown as NpmjsPluginRepository[],
        new MockLocal() as unknown as NpmPluginRepository,
      );
      expect(() => manager.checkForUpdates()).toThrow("No remote repository configured");
    });
  });

  describe("registerExtensions() / getRegisteredExtensions()", () => {
    it("returns empty array for unregistered extension point after registerExtensions", async () => {
      const manager = new NpmPluginManager(
        [] as unknown as NpmjsPluginRepository[],
        new MockLocal() as unknown as NpmPluginRepository,
      );

      await manager.registerExtensions("ep1");
      const results = await manager.getRegisteredExtensions("ep1");
      expect(results.length).toEqual(0);
    });

    it("returns empty array for never-registered extension point", async () => {
      const manager = new NpmPluginManager(
        [] as unknown as NpmjsPluginRepository[],
        new MockLocal() as unknown as NpmPluginRepository,
      );

      const results = await manager.getRegisteredExtensions("ep-unknown");
      expect(results.length).toEqual(0);
    });
  });

  describe("pluginManager injection", () => {
    class MockPluginManager implements PluginManager {
      public registerExtensionsCalls: string[] = [];
      public instantiateCalls: string[] = [];

      registerExtensions(extensionPoint: string): Promise<void> {
        this.registerExtensionsCalls.push(extensionPoint);
        return Promise.resolve();
      }

      getRegisteredExtensions(_extensionPoint: string): Promise<ReadonlyArray<ExtensionInfo>> {
        return Promise.resolve([{ extensionHandle: "mock-handle", pluginData: undefined }]);
      }

      instantiate(extensionHandle: string, _hostData?: Map<string, string>): Promise<unknown> {
        this.instantiateCalls.push(extensionHandle);
        return Promise.resolve("mock-instance");
      }
    }

    it("delegates to an injected PluginManager instead of DefaultPluginManager", async () => {
      const mockPluginManager = new MockPluginManager();
      const manager = new NpmPluginManager(
        [] as unknown as NpmjsPluginRepository[],
        new MockLocal() as unknown as NpmPluginRepository,
        { pluginManager: mockPluginManager },
      );

      await manager.registerExtensions("ep1");
      expect(mockPluginManager.registerExtensionsCalls).toEqual(["ep1"]);

      const results = await manager.getRegisteredExtensions("ep1");
      expect(results.length).toEqual(1);
      expect(results[0].extensionHandle).toEqual("mock-handle");

      const instance = await manager.instantiate("mock-handle");
      expect(instance).toEqual("mock-instance");
      expect(mockPluginManager.instantiateCalls).toEqual(["mock-handle"]);
    });
  });

  describe("install command resolution", () => {
    afterEach(() => {
      spyOn(Bun, "which").mockRestore();
    });

    it("defaults to 'bun add' when bun is on PATH", () => {
      spyOn(Bun, "which").mockImplementation((binary: string) => (binary === "bun" ? "/usr/bin/bun" : null));

      expect(
        () =>
          new NpmPluginManager(
            [] as unknown as NpmjsPluginRepository[],
            new MockLocal() as unknown as NpmPluginRepository,
          ),
      ).not.toThrow();
    });

    it("falls back to 'npm install' when bun is not on PATH but npm is", () => {
      spyOn(Bun, "which").mockImplementation((binary: string) => (binary === "npm" ? "/usr/bin/npm" : null));

      expect(
        () =>
          new NpmPluginManager(
            [] as unknown as NpmjsPluginRepository[],
            new MockLocal() as unknown as NpmPluginRepository,
          ),
      ).not.toThrow();
    });

    it("throws when neither bun nor npm is on PATH and no installCommand is given", () => {
      spyOn(Bun, "which").mockImplementation(() => null);

      expect(
        () =>
          new NpmPluginManager(
            [] as unknown as NpmjsPluginRepository[],
            new MockLocal() as unknown as NpmPluginRepository,
          ),
      ).toThrow("Neither 'bun' nor 'npm' found on PATH");
    });

    it("uses an explicit installCommand even when its binary would not be the auto-detected default", () => {
      spyOn(Bun, "which").mockImplementation((binary: string) => (binary === "npm" ? "/usr/bin/npm" : null));

      expect(
        () =>
          new NpmPluginManager(
            [] as unknown as NpmjsPluginRepository[],
            new MockLocal() as unknown as NpmPluginRepository,
            { installCommand: "npm install" },
          ),
      ).not.toThrow();
    });

    it("throws when an explicit installCommand's binary is not on PATH", () => {
      spyOn(Bun, "which").mockImplementation(() => null);

      expect(
        () =>
          new NpmPluginManager(
            [] as unknown as NpmjsPluginRepository[],
            new MockLocal() as unknown as NpmPluginRepository,
            { installCommand: "yarn add" },
          ),
      ).toThrow("Install command binary 'yarn' not found on PATH");
    });
  });
});
