import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import NpmPluginRepository from "../../../src/plugin_manager/plugin_repository/NpmPluginRepository.ts";

const NAMESPACE = "mypluginframework";

let nodeModulesDir: string;

beforeEach(async () => {
  const base = await mkdtemp(path.join(tmpdir(), "npm-repo-test-"));
  nodeModulesDir = path.join(base, "node_modules");
  await mkdir(nodeModulesDir, { recursive: true });
});

afterEach(async () => {
  await rm(path.dirname(nodeModulesDir), { recursive: true, force: true });
});

async function writePackageJson(pkgName: string, contents: Record<string, unknown>): Promise<void> {
  const pkgDir = path.join(nodeModulesDir, pkgName);
  await mkdir(pkgDir, { recursive: true });
  await Bun.write(path.join(pkgDir, "package.json"), JSON.stringify(contents));
}

describe("NpmPluginRepository Tests", () => {
  describe("getPlugins()", () => {
    it("returns empty when nodeModulesPath does not exist", async () => {
      const repo = new NpmPluginRepository("/nonexistent/node_modules", NAMESPACE);
      const results: unknown[] = [];
      for await (const d of repo.getPlugins()) {
        results.push(d);
      }
      expect(results.length).toEqual(0);
    });

    it("returns descriptors for packages that have the namespace key", async () => {
      await writePackageJson("my-plugin", {
        name: "my-plugin",
        version: "1.2.3",
        [NAMESPACE]: {
          extensionPoints: ["ep1", "ep2"],
          pluginData: { foo: "bar" },
        },
      });

      const repo = new NpmPluginRepository(nodeModulesDir, NAMESPACE);
      const results: {
        pluginId: string;
        name: string;
        version: string;
        extensionPoints: string[];
      }[] = [];
      for await (const d of repo.getPlugins()) {
        results.push(d);
      }

      expect(results.length).toEqual(1);
      expect(results[0].pluginId).toEqual("my-plugin");
      expect(results[0].name).toEqual("my-plugin");
      expect(results[0].version).toEqual("1.2.3");
      expect(results[0].extensionPoints).toEqual(["ep1", "ep2"]);
    });

    it("skips packages without the namespace key", async () => {
      await writePackageJson("not-a-plugin", {
        name: "not-a-plugin",
        version: "1.0.0",
      });

      const repo = new NpmPluginRepository(nodeModulesDir, NAMESPACE);
      const results: unknown[] = [];
      for await (const d of repo.getPlugins()) {
        results.push(d);
      }
      expect(results.length).toEqual(0);
    });

    it("skips packages where namespace key has no extensionPoints", async () => {
      await writePackageJson("incomplete-plugin", {
        name: "incomplete-plugin",
        version: "1.0.0",
        [NAMESPACE]: { pluginData: { x: "y" } },
      });

      const repo = new NpmPluginRepository(nodeModulesDir, NAMESPACE);
      const results: unknown[] = [];
      for await (const d of repo.getPlugins()) {
        results.push(d);
      }
      expect(results.length).toEqual(0);
    });

    it("handles scoped packages", async () => {
      await writePackageJson("@myscope/scoped-plugin", {
        name: "@myscope/scoped-plugin",
        version: "3.0.0",
        [NAMESPACE]: {
          extensionPoints: ["ep1"],
        },
      });

      const repo = new NpmPluginRepository(nodeModulesDir, NAMESPACE);
      const results: { pluginId: string; name: string; scope?: string }[] = [];
      for await (const d of repo.getPlugins()) {
        results.push(d);
      }

      expect(results.length).toEqual(1);
      expect(results[0].pluginId).toEqual("@myscope/scoped-plugin");
      expect(results[0].name).toEqual("scoped-plugin");
      expect(results[0].scope).toEqual("@myscope");
    });

    it("mixes plain and scoped packages", async () => {
      await writePackageJson("plain-plugin", {
        name: "plain-plugin",
        version: "1.0.0",
        [NAMESPACE]: { extensionPoints: ["ep1"] },
      });
      await writePackageJson("@scope/scoped-plugin", {
        name: "@scope/scoped-plugin",
        version: "2.0.0",
        [NAMESPACE]: { extensionPoints: ["ep2"] },
      });

      const repo = new NpmPluginRepository(nodeModulesDir, NAMESPACE);
      const ids: string[] = [];
      for await (const d of repo.getPlugins()) {
        ids.push(d.pluginId);
      }

      expect(ids.sort()).toEqual(["@scope/scoped-plugin", "plain-plugin"]);
    });
  });
});
