import { assertEquals, assertNotEquals, path } from "../../test_deps.ts";
import UrlPluginSource from "../../../src/plugin_manager/plugin_repository/UrlPluginSource.ts";

const PLUGIN_1_URL = "file://" +
  path.join(
    path.dirname(path.fromFileUrl(import.meta.url)),
    "../../fixtures/ValidPlugin1.ts",
  );

const INVALID_PLUGIN_URL = "file://" +
  path.join(
    path.dirname(path.fromFileUrl(import.meta.url)),
    "../../fixtures/InvalidPlugin1.ts",
  );

Deno.test("Returns undefined on invalid plugin", async () => {
  const urlPluginSource = new UrlPluginSource();

  assertEquals(
    await urlPluginSource.loadPlugin(
      new URL(INVALID_PLUGIN_URL),
    ),
    undefined,
  );
});

Deno.test("Loads a plugin", async () => {
  const urlPluginSource = new UrlPluginSource();

  const plugin = await urlPluginSource.loadPlugin(new URL(PLUGIN_1_URL));

  assertNotEquals(plugin, undefined);
  assertEquals(plugin?.extensionDescriptors.length, 1);
});

Deno.test("Can load a plugin twice", async () => {
  const urlPluginSource = new UrlPluginSource();

  let plugin = await urlPluginSource.loadPlugin(new URL(PLUGIN_1_URL));

  assertNotEquals(plugin, undefined);

  plugin = await urlPluginSource.loadPlugin(new URL(PLUGIN_1_URL));

  assertNotEquals(plugin, undefined);
});
