import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import NpmjsPluginRepository, {
  type NpmSearchQuery,
} from "../../../src/plugin_manager/plugin_repository/NpmjsPluginRepository.ts";

const NAMESPACE = "mypluginframework";
const REGISTRY_URL = "https://registry.example.com";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeSearchResult(packages: Array<{ name: string; version: string; keywords?: string[] }>) {
  return {
    objects: packages.map((pkg) => ({
      package: {
        name: pkg.name,
        version: pkg.version,
        keywords: pkg.keywords ?? [NAMESPACE],
      },
    })),
  };
}

function makePackageMeta(extensionPoints: string[]) {
  return {
    version: "1.0.0",
    [NAMESPACE]: { extensionPoints },
  };
}

function mockFetch(searchResult: unknown, metaResult: unknown) {
  globalThis.fetch = mock((url: string | URL | Request) => {
    const urlStr = url.toString();
    if (urlStr.includes("/-/v1/search")) {
      return Promise.resolve(
        new Response(JSON.stringify(searchResult), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(metaResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as unknown as typeof fetch;
}

describe("NpmjsPluginRepository Tests", () => {
  let repo: NpmjsPluginRepository;

  beforeEach(() => {
    repo = new NpmjsPluginRepository({
      name: "NPMjs",
      description: "Public npm registry",
      author: "npm Inc.",
      registryUrl: REGISTRY_URL,
      packageJsonNamespace: NAMESPACE,
    });
  });

  it("exposes name, description, author and url from constructor", () => {
    expect(repo.name).toEqual("NPMjs");
    expect(repo.description).toEqual("Public npm registry");
    expect(repo.author).toEqual("npm Inc.");
    expect(repo.url).toEqual(REGISTRY_URL);
  });

  describe("search()", () => {
    it("returns descriptors for packages that have the namespace keyword", async () => {
      const searchResult = makeSearchResult([
        { name: "my-plugin", version: "1.0.0", keywords: [NAMESPACE] },
      ]);
      mockFetch(searchResult, makePackageMeta(["ep1"]));

      const results: { pluginId: string; name: string; extensionPoints: string[] }[] = [];
      for await (const d of repo.search({ text: "plugin" })) {
        results.push(d);
      }

      expect(results.length).toEqual(1);
      expect(results[0].pluginId).toEqual("my-plugin");
      expect(results[0].name).toEqual("my-plugin");
      expect(results[0].extensionPoints).toEqual(["ep1"]);
    });

    it("filters out packages that do not have the namespace keyword", async () => {
      const searchResult = makeSearchResult([
        { name: "my-plugin", version: "1.0.0", keywords: [NAMESPACE] },
        { name: "unrelated", version: "1.0.0", keywords: ["something-else"] },
      ]);
      mockFetch(searchResult, makePackageMeta(["ep1"]));

      const results: unknown[] = [];
      for await (const d of repo.search({})) {
        results.push(d);
      }
      expect(results.length).toEqual(1);
    });

    it("handles scoped packages correctly", async () => {
      const searchResult = makeSearchResult([
        { name: "@myscope/scoped-plugin", version: "2.0.0", keywords: [NAMESPACE] },
      ]);
      mockFetch(searchResult, makePackageMeta(["ep1"]));

      const results: { pluginId: string; name: string; scope?: string }[] = [];
      for await (const d of repo.search({})) {
        results.push(d);
      }

      expect(results.length).toEqual(1);
      expect(results[0].pluginId).toEqual("@myscope/scoped-plugin");
      expect(results[0].name).toEqual("scoped-plugin");
      expect(results[0].scope).toEqual("@myscope");
    });

    it("appends extra keywords to the search query", async () => {
      const fetchMock = mock((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/-/v1/search")) {
          expect(urlStr).toContain("keywords%3Aextra-kw");
          return Promise.resolve(
            new Response(JSON.stringify(makeSearchResult([])), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(new Response("{}", { status: 200 }));
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const q: NpmSearchQuery = { text: "foo", keywords: ["extra-kw"] };
      for await (const _d of repo.search(q)) {
        // consume
      }
    });
  });

  describe("getExtensionDescriptorFromExtensionEntry()", () => {
    it("rejects with appropriate message", async () => {
      expect(
        repo.getExtensionDescriptorFromExtensionEntry({
          pluginId: "my-plugin",
          extensionId: "0",
          extensionPoint: "ep1",
        }),
      ).rejects.toThrow("install the plugin locally first");
    });
  });

  describe("auth", () => {
    it("sends Bearer token when authToken is provided", async () => {
      const authedRepo = new NpmjsPluginRepository({
        name: "authed",
        registryUrl: REGISTRY_URL,
        packageJsonNamespace: NAMESPACE,
        authToken: "my-secret-token",
      });

      let capturedHeaders: Headers | undefined;
      globalThis.fetch = mock((_url: string | URL | Request, init?: RequestInit) => {
        capturedHeaders = init?.headers as Headers;
        return Promise.resolve(
          new Response(JSON.stringify(makeSearchResult([])), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }) as unknown as typeof fetch;

      for await (const _d of authedRepo.search({})) {
        // consume
      }

      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders!.get("Authorization")).toEqual("Bearer my-secret-token");
    });

    it("sends Basic auth when username and password are provided", async () => {
      const authedRepo = new NpmjsPluginRepository({
        name: "authed",
        registryUrl: REGISTRY_URL,
        packageJsonNamespace: NAMESPACE,
        username: "user",
        password: "pass",
      });

      let capturedHeaders: Headers | undefined;
      globalThis.fetch = mock((_url: string | URL | Request, init?: RequestInit) => {
        capturedHeaders = init?.headers as Headers;
        return Promise.resolve(
          new Response(JSON.stringify(makeSearchResult([])), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }) as unknown as typeof fetch;

      for await (const _d of authedRepo.search({})) {
        // consume
      }

      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders!.get("Authorization")).toEqual(`Basic ${btoa("user:pass")}`);
    });

    it("throws when both authToken and username are provided", () => {
      expect(
        () =>
          new NpmjsPluginRepository({
            name: "bad",
            registryUrl: REGISTRY_URL,
            packageJsonNamespace: NAMESPACE,
            authToken: "token",
            username: "user",
          }),
      ).toThrow("Cannot specify both authToken and username/password auth");
    });
  });
});
