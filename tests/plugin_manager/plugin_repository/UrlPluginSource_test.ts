import { describe, expect, test } from "bun:test";
import path from "node:path";
import UrlPluginSource from "../../../src/plugin_manager/plugin_repository/UrlPluginSource.ts";

const PLUGIN_1_URL = "file://" +
  path.join(
    path.dirname(Bun.fileURLToPath(import.meta.url)),
    "../../fixtures/ValidPlugin1.ts",
  );

const INVALID_PLUGIN_URL = "file://" +
  path.join(
    path.dirname(Bun.fileURLToPath(import.meta.url)),
    "../../fixtures/InvalidPlugin1.ts",
  );

describe("UrlPluginSource Tests", () => {
  test("Throws on invalid plugin",   () => {
    const urlPluginSource = new UrlPluginSource();

    expect(
      urlPluginSource.loadPlugin(
        new URL(INVALID_PLUGIN_URL),
      ),
    ).rejects.toThrow();
  });

  test("Loads a plugin", async () => {
    const urlPluginSource = new UrlPluginSource();

    const plugin = await urlPluginSource.loadPlugin(new URL(PLUGIN_1_URL));

    expect(plugin).not.toEqual(undefined);
    expect(plugin?.extensionDescriptors.length).toEqual(1);
  });

  test("Can load a plugin twice", async () => {
    const urlPluginSource = new UrlPluginSource();

    let plugin = await urlPluginSource.loadPlugin(new URL(PLUGIN_1_URL));

    expect(plugin).not.toEqual(undefined);

    plugin = await urlPluginSource.loadPlugin(new URL(PLUGIN_1_URL));

    expect(plugin).not.toEqual(undefined);
  });
});
