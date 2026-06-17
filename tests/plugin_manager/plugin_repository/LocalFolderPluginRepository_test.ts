import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import LocalFolderPluginRepository from "../../../src/plugin_manager/plugin_repository/LocalFolderPluginRepository.ts";

const MANIFEST_FILE = "manifest.json";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "local-repo-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("LocalFolderPluginRepository Tests", () => {
  describe("getPlugins()", () => {
    it("returns empty when manifest file does not exist", async () => {
      const repo = new LocalFolderPluginRepository(tmpDir, MANIFEST_FILE);
      const results: unknown[] = [];
      for await (const d of repo.getPlugins()) {
        results.push(d);
      }
      expect(results.length).toEqual(0);
    });

    it("returns descriptors from manifest entries", async () => {
      const entries = [
        {
          pluginId: "plugin-a",
          bundlePath: "/some/path/a.js",
          extensionPoints: ["ep1", "ep2"],
          name: "plugin-a",
          version: "1.0.0",
          scope: "@myscope",
          pluginData: { key: "val" },
        },
        {
          pluginId: "plugin-b",
          bundlePath: "/some/path/b.js",
          extensionPoints: ["ep1"],
          name: "plugin-b",
          version: "2.0.0",
        },
      ];
      await Bun.write(path.join(tmpDir, MANIFEST_FILE), JSON.stringify(entries));

      const repo = new LocalFolderPluginRepository(tmpDir, MANIFEST_FILE);
      const results: Awaited<ReturnType<typeof repo.getPlugins>> extends AsyncIterable<infer T>
        ? T[]
        : never[] = [];
      for await (const d of repo.getPlugins()) {
        results.push(d);
      }

      expect(results.length).toEqual(2);
      expect(results[0].pluginId).toEqual("plugin-a");
      expect(results[0].name).toEqual("plugin-a");
      expect(results[0].version).toEqual("1.0.0");
      expect(results[0].scope).toEqual("@myscope");
      expect(results[0].extensionPoints).toEqual(["ep1", "ep2"]);
      expect(results[0].pluginData?.get("key")).toEqual("val");
      expect(results[1].pluginId).toEqual("plugin-b");
      expect(results[1].scope).toBeUndefined();
    });

    it("filters correctly by extensionPoints field", async () => {
      const entries = [
        {
          pluginId: "plugin-a",
          bundlePath: "/some/path/a.js",
          extensionPoints: ["ep1"],
          name: "plugin-a",
          version: "1.0.0",
        },
        {
          pluginId: "plugin-b",
          bundlePath: "/some/path/b.js",
          extensionPoints: ["ep2"],
          name: "plugin-b",
          version: "1.0.0",
        },
      ];
      await Bun.write(path.join(tmpDir, MANIFEST_FILE), JSON.stringify(entries));

      const repo = new LocalFolderPluginRepository(tmpDir, MANIFEST_FILE);
      const ids: string[] = [];
      for await (const d of repo.getPlugins()) {
        ids.push(d.pluginId);
      }
      expect(ids).toEqual(["plugin-a", "plugin-b"]);
    });
  });

  describe("getExtensionDescriptorFromExtensionEntry()", () => {
    it("rejects with error for unknown pluginId", async () => {
      const entries = [
        {
          pluginId: "plugin-known",
          bundlePath: "/some/path/a.js",
          extensionPoints: ["ep1"],
          name: "plugin-known",
          version: "1.0.0",
        },
      ];
      await Bun.write(path.join(tmpDir, MANIFEST_FILE), JSON.stringify(entries));

      const repo = new LocalFolderPluginRepository(tmpDir, MANIFEST_FILE);
      await expect(
        repo.getExtensionDescriptorFromExtensionEntry({
          pluginId: "plugin-unknown",
          extensionId: "0",
          extensionPoint: "ep1",
        }),
      ).rejects.toThrow("plugin-unknown");
    });
  });

  describe("scanForExtensions()", () => {
    it("returns empty when manifest does not exist", async () => {
      const repo = new LocalFolderPluginRepository(tmpDir, MANIFEST_FILE);
      const results: unknown[] = [];
      for await (const e of repo.scanForExtensions("ep1")) {
        results.push(e);
      }
      expect(results.length).toEqual(0);
    });

    it("returns empty when no entry matches extension point", async () => {
      const entries = [
        {
          pluginId: "plugin-a",
          bundlePath: "/some/path/a.js",
          extensionPoints: ["ep2"],
          name: "plugin-a",
          version: "1.0.0",
        },
      ];
      await Bun.write(path.join(tmpDir, MANIFEST_FILE), JSON.stringify(entries));

      const repo = new LocalFolderPluginRepository(tmpDir, MANIFEST_FILE);
      const results: unknown[] = [];
      for await (const e of repo.scanForExtensions("ep1")) {
        results.push(e);
      }
      expect(results.length).toEqual(0);
    });
  });
});
