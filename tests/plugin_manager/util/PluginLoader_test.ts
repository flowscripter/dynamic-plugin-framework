import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as Runtime from "../../../src/shared/Runtime.ts";
import { describeSharedModules, registerSharedModules } from "../../../src/shared/SharedModules.ts";
import loadPlugin from "../../../src/plugin_manager/util/PluginLoader.ts";

describe("PluginLoader Tests", () => {
  test("Rejects invalid URL", async () => {
    const pluginLoadResult = await loadPlugin("foo");

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.message).toStartWith("Cannot find package");
  });

  test("Rejects invalid modules", async () => {
    const pluginLoadResult = await loadPlugin("../plugin_repository/UrlListPluginRepository.ts");

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.message).toEqual(
      "Plugin from ../plugin_repository/UrlListPluginRepository.ts does not provide an extensionDescriptors array",
    );
  });

  test("Rejects invalid plugins", async () => {
    let pluginLoadResult = await loadPlugin("../../../tests/fixtures/InvalidPlugin1.ts");

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.name).toEqual("Error");
    expect(pluginLoadResult.error?.message).toEqual(
      "Plugin from ../../../tests/fixtures/InvalidPlugin1.ts does not provide an extensionDescriptors array",
    );

    pluginLoadResult = await loadPlugin("../../../tests/fixtures/InvalidPlugin2.ts");

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.name).toEqual("Error");
    expect(pluginLoadResult.error?.message).toEqual(
      "Plugin from ../../../tests/fixtures/InvalidPlugin2.ts does not provide an extensionPoint string in one of the extensionDescriptors",
    );

    pluginLoadResult = await loadPlugin("../../../tests/fixtures/InvalidPlugin3.ts");

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.name).toEqual("Error");
    expect(pluginLoadResult.error?.message).toEqual(
      "Plugin from ../../../tests/fixtures/InvalidPlugin3.ts does not provide a factory with a create function in one of the extensionDescriptors",
    );

    pluginLoadResult = await loadPlugin("../../../tests/fixtures/InvalidPlugin4.ts");

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.name).toEqual("Error");
    expect(pluginLoadResult.error?.message).toEqual(
      "Plugin from ../../../tests/fixtures/InvalidPlugin4.ts does not provide a factory with a create function in one of the extensionDescriptors",
    );

    pluginLoadResult = await loadPlugin("../../../tests/fixtures/InvalidPlugin5.ts");

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.name).toEqual("Error");
    expect(pluginLoadResult.error?.message).toEqual(
      "Plugin from ../../../tests/fixtures/InvalidPlugin5.ts does not provide a factory with a create function in one of the extensionDescriptors",
    );
  });

  test("Returns valid plugin", async () => {
    const pluginLoadResult = await loadPlugin("../../../tests/fixtures/ValidPlugin1.ts");

    expect(pluginLoadResult.isValidPlugin).toBeTrue();
    expect(pluginLoadResult.error).toBeUndefined();

    const plugin = pluginLoadResult.plugin;

    expect(plugin?.pluginData?.get("foo")).toEqual("bar");

    expect(plugin?.extensionDescriptors.length).toEqual(1);

    const extensionDescriptor = plugin?.extensionDescriptors[0];

    expect(extensionDescriptor?.extensionData?.get("foo")).toEqual("bar");

    await extensionDescriptor?.factory.create();
  });
});

describe("PluginLoader shared module Tests", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "plugin-loader-shared-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function pluginSource(specifier: string | undefined, sharedModules?: Record<string, string>) {
    return `${specifier ? `import { SharedError } from "${specifier}";` : ""}
export default {
  ${sharedModules ? `sharedModules: ${JSON.stringify(sharedModules)},` : ""}
  extensionDescriptors: [
    { extensionPoint: "foo", factory: { create: () => Promise.resolve(${specifier ? "new SharedError()" : "{}"}) } },
  ],
};
`;
  }

  async function writePlugin(name: string, source: string): Promise<string> {
    const file = path.join(tempDir, name);
    await Bun.write(file, source);
    return file;
  }

  async function withServer<T>(
    files: Record<string, string>,
    fn: (baseUrl: string) => Promise<T>,
  ): Promise<T> {
    const server = Bun.serve({
      port: 0,
      fetch: (req) => {
        const body = files[new URL(req.url).pathname];
        return body === undefined
          ? new Response("not found", { status: 404 })
          : new Response(body, { headers: { "content-type": "text/javascript" } });
      },
    });
    try {
      return await fn(`http://localhost:${server.port}`);
    } finally {
      await server.stop(true);
    }
  }

  test("Fetched bundle with unregistered bare import is rejected before import", async () => {
    await withServer({ "/p.js": pluginSource("pl-test-unregistered") }, async (base) => {
      const result = await loadPlugin(`${base}/p.js`, path.join(tempDir, "cache1"), "repo");

      expect(result.isValidPlugin).toBeFalse();
      expect(result.error?.message).toEqual(
        `Plugin from ${base}/p.js imports 'pl-test-unregistered' which is not provided by the host (register it with registerSharedModules)`,
      );
    });
  });

  test("Fetched bundle with registered bare import receives the host module", async () => {
    class SharedError extends Error {}
    const cache = path.join(tempDir, "cache2");
    await withServer({ "/p.js": pluginSource("pl-test-registered") }, async (base) => {
      const rejected = await loadPlugin(`${base}/p.js`, cache, "repo");
      expect(rejected.isValidPlugin).toBeFalse();

      registerSharedModules({ "pl-test-registered": { exports: { SharedError } } });

      const result = await loadPlugin(`${base}/p.js`, cache, "repo");

      expect(result.error).toBeUndefined();
      expect(result.isValidPlugin).toBeTrue();
      const extension = await result.plugin!.extensionDescriptors[0]!.factory.create();
      expect(extension instanceof SharedError).toBeTrue();
    });
  });

  test("Fetched bundle with only builtin, relative and url imports passes the preflight", async () => {
    const source = `import path from "node:path";
import fs from "fs";
import bun from "bun";
import "data:text/javascript,export default 1";
${pluginSource(undefined)}`;
    await withServer({ "/p.js": source }, async (base) => {
      const result = await loadPlugin(`${base}/p.js`, path.join(tempDir, "cache3"), "repo");

      expect(result.error).toBeUndefined();
      expect(result.isValidPlugin).toBeTrue();
    });
  });

  test("Fetched bundle which cannot be scanned is rejected", async () => {
    await withServer({ "/p.js": "export default {{{" }, async (base) => {
      const result = await loadPlugin(`${base}/p.js`, path.join(tempDir, "cache4"), "repo");

      expect(result.isValidPlugin).toBeFalse();
      expect(result.error).toBeDefined();
    });
  });

  test("Local plugin with unregistered bare import is not preflighted", async () => {
    const file = await writePlugin("local-bare.js", pluginSource("pl-test-local-unregistered"));

    const result = await loadPlugin(file);

    expect(result.isValidPlugin).toBeFalse();
    expect(result.error?.message).not.toContain("not provided by the host");
  });

  test("sharedModules ranges are checked against the registered version", async () => {
    registerSharedModules({ "pl-test-range": { version: "3.1.0", exports: {} } });

    const ok = await loadPlugin(
      await writePlugin("range-ok.js", pluginSource(undefined, { "pl-test-range": "^3.0.0" })),
    );
    expect(ok.error).toBeUndefined();
    expect(ok.isValidPlugin).toBeTrue();

    const bad = await loadPlugin(
      await writePlugin("range-bad.js", pluginSource(undefined, { "pl-test-range": "^4.0.0" })),
    );
    expect(bad.isValidPlugin).toBeFalse();
    expect(bad.plugin).toBeUndefined();
    expect(bad.error?.message).toEqual(
      `Plugin from ${path.join(tempDir, "range-bad.js")} requires 'pl-test-range' ^4.0.0 but host provides 3.1.0`,
    );
  });

  test("sharedModules ranges accept prerelease versions", async () => {
    registerSharedModules({ "pl-test-pre": { version: "2.0.0-beta.1", exports: {} } });

    const result = await loadPlugin(
      await writePlugin(
        "range-pre.js",
        pluginSource(undefined, { "pl-test-pre": "^2.0.0-beta.0" }),
      ),
    );

    expect(result.isValidPlugin).toBeTrue();
  });

  test("sharedModules entry not provided by the host is rejected", async () => {
    const file = await writePlugin(
      "range-missing.js",
      pluginSource(undefined, { "pl-test-missing": "^1.0.0" }),
    );

    const result = await loadPlugin(file);

    expect(result.isValidPlugin).toBeFalse();
    expect(result.error?.message).toEqual(
      `Plugin from ${file} requires shared module 'pl-test-missing' which is not provided by the host`,
    );
  });

  test("sharedModules entry with an invalid range is rejected", async () => {
    registerSharedModules({ "pl-test-invalid-range": { version: "1.0.0", exports: {} } });
    const file = await writePlugin(
      "range-invalid.js",
      pluginSource(undefined, { "pl-test-invalid-range": "not a range" }),
    );

    const result = await loadPlugin(file);

    expect(result.isValidPlugin).toBeFalse();
    expect(result.error?.message).toEqual(
      `Plugin from ${file} declares invalid version range 'not a range' for shared module 'pl-test-invalid-range'`,
    );
  });

  test("sharedModules entry for a module registered without a version passes with a warning", async () => {
    registerSharedModules({ "pl-test-noversion": { exports: {} } });
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await loadPlugin(
        await writePlugin(
          "range-noversion.js",
          pluginSource(undefined, { "pl-test-noversion": "^1.0.0" }),
        ),
      );

      expect(result.isValidPlugin).toBeTrue();
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  describe("without Bun (browser)", () => {
    let spy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      spy = spyOn(Runtime, "isBunRuntime").mockReturnValue(false);
    });

    afterEach(() => {
      spy.mockRestore();
    });

    test("imports directly and checks ranges against versions from describeSharedModules", async () => {
      describeSharedModules({ "pl-test-browser": "1.4.0" });

      const ok = await loadPlugin(
        await writePlugin(
          "browser-ok.js",
          pluginSource(undefined, { "pl-test-browser": "^1.0.0" }),
        ),
      );
      expect(ok.error).toBeUndefined();
      expect(ok.isValidPlugin).toBeTrue();

      const bad = await loadPlugin(
        await writePlugin(
          "browser-bad.js",
          pluginSource(undefined, { "pl-test-browser": "^2.0.0" }),
        ),
      );
      expect(bad.isValidPlugin).toBeFalse();
    });
  });
});
