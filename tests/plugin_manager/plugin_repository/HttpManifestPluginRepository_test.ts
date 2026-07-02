import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import HttpManifestPluginRepository from "../../../src/plugin_manager/plugin_repository/HttpManifestPluginRepository.ts";

const MANIFEST_URL = "https://example.com/manifest.json";

let tmpDir: string;
const originalFetch = globalThis.fetch;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "http-repo-test-"));
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await rm(tmpDir, { recursive: true, force: true });
});

function makeManifest() {
  return [
    {
      bundleUrl: "https://example.com/plugin-a.js",
      extensionPoints: ["ep1", "ep2"],
      name: "plugin-a",
      version: "1.0.0",
      scope: "@myscope",
      pluginData: { key: "val" },
    },
    {
      bundleUrl: "https://example.com/plugin-b.js",
      extensionPoints: ["ep2"],
      name: "plugin-b",
      version: "2.0.0",
    },
  ];
}

function mockFetchWithManifest(manifest: unknown) {
  const fetchMock = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("HttpManifestPluginRepository Tests", () => {
  it("exposes name, description, author and url from constructor", () => {
    const repo = new HttpManifestPluginRepository({
      manifestUrl: MANIFEST_URL,
      name: "My Repo",
      description: "A test repo",
      author: "Alice",
      cacheFolder: tmpDir,
    });
    expect(repo.name).toEqual("My Repo");
    expect(repo.description).toEqual("A test repo");
    expect(repo.author).toEqual("Alice");
    expect(repo.url).toEqual(MANIFEST_URL);
  });

  describe("getPlugins()", () => {
    it("returns descriptors from fetched manifest", async () => {
      mockFetchWithManifest(makeManifest());
      const repo = new HttpManifestPluginRepository({
        manifestUrl: MANIFEST_URL,
        name: "Test",
        cacheFolder: tmpDir,
      });

      const results: { pluginId: string; name: string; version: string; scope?: string }[] = [];
      for await (const d of repo.getPlugins()) {
        results.push(d);
      }

      expect(results.length).toEqual(2);
      expect(results[0].pluginId).toEqual("https://example.com/plugin-a.js");
      expect(results[0].name).toEqual("plugin-a");
      expect(results[0].version).toEqual("1.0.0");
      expect(results[0].scope).toEqual("@myscope");
      expect(results[1].pluginId).toEqual("https://example.com/plugin-b.js");
    });

    it("fetches manifest only once across multiple calls", async () => {
      const fetchMock = mockFetchWithManifest(makeManifest());
      const repo = new HttpManifestPluginRepository({
        manifestUrl: MANIFEST_URL,
        name: "Test",
        cacheFolder: tmpDir,
      });

      for await (const _d of repo.getPlugins()) {
        // consume
      }
      for await (const _d of repo.getPlugins()) {
        // consume again
      }

      expect(fetchMock.mock.calls.length).toEqual(1);
    });
  });

  describe("getPlugin()", () => {
    it("returns the descriptor matching the bundleUrl", async () => {
      mockFetchWithManifest(makeManifest());
      const repo = new HttpManifestPluginRepository({
        manifestUrl: MANIFEST_URL,
        name: "Test",
        cacheFolder: tmpDir,
      });

      const result = await repo.getPlugin("https://example.com/plugin-a.js");
      expect(result).toBeDefined();
      expect(result!.name).toEqual("plugin-a");
      expect(result!.version).toEqual("1.0.0");
    });

    it("returns undefined when no entry matches", async () => {
      mockFetchWithManifest(makeManifest());
      const repo = new HttpManifestPluginRepository({
        manifestUrl: MANIFEST_URL,
        name: "Test",
        cacheFolder: tmpDir,
      });

      expect(await repo.getPlugin("https://example.com/nonexistent.js")).toBeUndefined();
    });
  });

  describe("search()", () => {
    it("returns all entries for empty query text", async () => {
      mockFetchWithManifest(makeManifest());
      const repo = new HttpManifestPluginRepository({
        manifestUrl: MANIFEST_URL,
        name: "Test",
        cacheFolder: tmpDir,
      });

      const results: unknown[] = [];
      for await (const d of repo.search({})) {
        results.push(d);
      }
      expect(results.length).toEqual(2);
    });

    it("returns matching entries for text matching name", async () => {
      mockFetchWithManifest(makeManifest());
      const repo = new HttpManifestPluginRepository({
        manifestUrl: MANIFEST_URL,
        name: "Test",
        cacheFolder: tmpDir,
      });

      const results: { name: string }[] = [];
      for await (const d of repo.search({ text: "plugin-a" })) {
        results.push(d);
      }
      expect(results.length).toEqual(1);
      expect(results[0].name).toEqual("plugin-a");
    });

    it("returns matching entries for text matching extensionPoints", async () => {
      mockFetchWithManifest(makeManifest());
      const repo = new HttpManifestPluginRepository({
        manifestUrl: MANIFEST_URL,
        name: "Test",
        cacheFolder: tmpDir,
      });

      const results: unknown[] = [];
      for await (const d of repo.search({ text: "ep2" })) {
        results.push(d);
      }
      expect(results.length).toEqual(2);
    });

    it("is case-insensitive", async () => {
      mockFetchWithManifest(makeManifest());
      const repo = new HttpManifestPluginRepository({
        manifestUrl: MANIFEST_URL,
        name: "Test",
        cacheFolder: tmpDir,
      });

      const results: unknown[] = [];
      for await (const d of repo.search({ text: "PLUGIN-A" })) {
        results.push(d);
      }
      expect(results.length).toEqual(1);
    });

    it("returns nothing when text does not match any entry", async () => {
      mockFetchWithManifest(makeManifest());
      const repo = new HttpManifestPluginRepository({
        manifestUrl: MANIFEST_URL,
        name: "Test",
        cacheFolder: tmpDir,
      });

      const results: unknown[] = [];
      for await (const d of repo.search({ text: "nonexistent-xyz" })) {
        results.push(d);
      }
      expect(results.length).toEqual(0);
    });
  });
});
