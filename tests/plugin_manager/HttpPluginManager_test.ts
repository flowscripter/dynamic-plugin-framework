import { describe, expect, it } from "bun:test";
import HttpPluginManager from "../../src/plugin_manager/HttpPluginManager.ts";
import type SearchQuery from "../../src/api/plugin_repository/SearchQuery.ts";
import type VersionedPluginDescriptor from "../../src/api/plugin_repository/VersionedPluginDescriptor.ts";
import type HttpManifestPluginRepository from "../../src/plugin_manager/plugin_repository/HttpManifestPluginRepository.ts";
import type LocalFolderPluginRepository from "../../src/plugin_manager/plugin_repository/LocalFolderPluginRepository.ts";
import type HttpPluginInstaller from "../../src/plugin_manager/plugin_installer/HttpPluginInstaller.ts";
import type VersionedPluginRepository from "../../src/api/plugin_repository/VersionedPluginRepository.ts";
import type ExtensionEntry from "../../src/api/plugin_repository/ExtensionEntry.ts";
import type ExtensionDescriptor from "../../src/api/plugin/ExtensionDescriptor.ts";

function makeDescriptor(pluginId: string, version = "1.0.0"): VersionedPluginDescriptor {
  return {
    pluginId,
    extensionPoints: ["ep1"],
    scope: undefined,
    name: pluginId,
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

class MockInstaller {
  public installedWith: {
    descriptor: VersionedPluginDescriptor;
    source: VersionedPluginRepository;
    target: VersionedPluginRepository;
    options: unknown;
  }[] = [];

  async install(
    descriptor: Readonly<VersionedPluginDescriptor>,
    source: VersionedPluginRepository,
    target: VersionedPluginRepository,
    options?: { includeDependencies?: boolean },
  ): Promise<void> {
    this.installedWith.push({ descriptor: { ...descriptor }, source, target, options });
  }

  async uninstall(_pluginId: string, _target: VersionedPluginRepository): Promise<void> {}

  async *checkForUpdates(
    _local: VersionedPluginRepository,
    _remote: VersionedPluginRepository,
  ): AsyncIterable<{ descriptor: Readonly<VersionedPluginDescriptor>; availableVersion: string }> {}
}

describe("HttpPluginManager", () => {
  describe("search()", () => {
    it("yields descriptors from a single remote", async () => {
      const remote = new MockRemote([makeDescriptor("plugin-a"), makeDescriptor("plugin-b")]);
      const manager = new HttpPluginManager(
        [remote] as unknown as HttpManifestPluginRepository[],
        new MockLocal() as unknown as LocalFolderPluginRepository,
        new MockInstaller() as unknown as HttpPluginInstaller,
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
        new MockInstaller() as unknown as HttpPluginInstaller,
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
    it("delegates to installer using the remote that contains the descriptor", async () => {
      const descriptor = makeDescriptor("plugin-a");
      const remote1 = new MockRemote([makeDescriptor("plugin-x")]);
      const remote2 = new MockRemote([descriptor]);
      const local = new MockLocal();
      const installer = new MockInstaller();

      const manager = new HttpPluginManager(
        [remote1, remote2] as unknown as HttpManifestPluginRepository[],
        local as unknown as LocalFolderPluginRepository,
        installer as unknown as HttpPluginInstaller,
      );

      await manager.install(descriptor);

      expect(installer.installedWith.length).toEqual(1);
      expect(installer.installedWith[0].descriptor.pluginId).toEqual("plugin-a");
      expect(installer.installedWith[0].source).toBe(remote2);
      expect(installer.installedWith[0].target).toBe(local);
    });

    it("throws when remotes array is empty", async () => {
      const manager = new HttpPluginManager(
        [] as unknown as HttpManifestPluginRepository[],
        new MockLocal() as unknown as LocalFolderPluginRepository,
        new MockInstaller() as unknown as HttpPluginInstaller,
      );

      expect(manager.install(makeDescriptor("plugin-a"))).rejects.toThrow(
        "not found in any configured remote repository",
      );
    });
  });

  describe("registerExtensions() / getRegisteredExtensions()", () => {
    it("returns empty array for unregistered extension point after registerExtensions", async () => {
      const manager = new HttpPluginManager(
        [] as unknown as HttpManifestPluginRepository[],
        new MockLocal() as unknown as LocalFolderPluginRepository,
        new MockInstaller() as unknown as HttpPluginInstaller,
      );

      await manager.registerExtensions("ep1");
      const results = await manager.getRegisteredExtensions("ep1");
      expect(results.length).toEqual(0);
    });

    it("returns empty array for never-registered extension point", async () => {
      const manager = new HttpPluginManager(
        [] as unknown as HttpManifestPluginRepository[],
        new MockLocal() as unknown as LocalFolderPluginRepository,
        new MockInstaller() as unknown as HttpPluginInstaller,
      );

      const results = await manager.getRegisteredExtensions("ep-unknown");
      expect(results.length).toEqual(0);
    });
  });
});
