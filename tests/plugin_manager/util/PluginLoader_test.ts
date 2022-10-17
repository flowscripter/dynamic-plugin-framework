import { assert, assertEquals, assertFalse } from "../../test_deps.ts";
import loadPlugin from "../../../src/plugin_manager/util/PluginLoader.ts";

Deno.test("Rejects invalid URL", async () => {
  const pluginLoadResult = await loadPlugin("foo");

  assertFalse(pluginLoadResult.isValidPlugin);
  assertEquals(pluginLoadResult.error?.name, "TypeError");
});

Deno.test("Rejects invalid modules", async () => {
  const pluginLoadResult = await loadPlugin(
    "../plugin_repository/UrlListPluginRepository.ts",
  );

  assertFalse(pluginLoadResult.isValidPlugin);
  assertEquals(pluginLoadResult.error?.name, "Error");
  assertEquals(
    pluginLoadResult.error?.message,
    "Plugin from ../plugin_repository/UrlListPluginRepository.ts does not provide an extensionDescriptors array",
  );
});

Deno.test("Rejects invalid plugins", async () => {
  let pluginLoadResult = await loadPlugin(
    "../../../tests/fixtures/InvalidPlugin1.ts",
  );

  assertFalse(pluginLoadResult.isValidPlugin);
  assertEquals(pluginLoadResult.error?.name, "Error");
  assertEquals(
    pluginLoadResult.error?.message,
    "Plugin from ../../../tests/fixtures/InvalidPlugin1.ts does not provide an extensionDescriptors array",
  );

  pluginLoadResult = await loadPlugin(
    "../../../tests/fixtures/InvalidPlugin2.ts",
  );

  assertFalse(pluginLoadResult.isValidPlugin);
  assertEquals(pluginLoadResult.error?.name, "Error");
  assertEquals(
    pluginLoadResult.error?.message,
    "Plugin from ../../../tests/fixtures/InvalidPlugin2.ts does not provide an extensionPoint string in one of the extensionDescriptors",
  );

  pluginLoadResult = await loadPlugin(
    "../../../tests/fixtures/InvalidPlugin3.ts",
  );

  assertFalse(pluginLoadResult.isValidPlugin);
  assertEquals(pluginLoadResult.error?.name, "Error");
  assertEquals(
    pluginLoadResult.error?.message,
    "Plugin from ../../../tests/fixtures/InvalidPlugin3.ts does not provide a factory with a create function in one of the extensionDescriptors",
  );

  pluginLoadResult = await loadPlugin(
    "../../../tests/fixtures/InvalidPlugin4.ts",
  );

  assertFalse(pluginLoadResult.isValidPlugin);
  assertEquals(pluginLoadResult.error?.name, "Error");
  assertEquals(
    pluginLoadResult.error?.message,
    "Plugin from ../../../tests/fixtures/InvalidPlugin4.ts does not provide a factory with a create function in one of the extensionDescriptors",
  );

  pluginLoadResult = await loadPlugin(
    "../../../tests/fixtures/InvalidPlugin5.ts",
  );

  assertFalse(pluginLoadResult.isValidPlugin);
  assertEquals(pluginLoadResult.error?.name, "Error");
  assertEquals(
    pluginLoadResult.error?.message,
    "Plugin from ../../../tests/fixtures/InvalidPlugin5.ts does not provide a factory with a create function in one of the extensionDescriptors",
  );
});

Deno.test("Returns valid plugin", async () => {
  const pluginLoadResult = await loadPlugin(
    "../../../tests/fixtures/ValidPlugin1.ts",
  );

  assert(pluginLoadResult.isValidPlugin);
  assertFalse(pluginLoadResult.error);

  const plugin = pluginLoadResult.plugin;

  assertEquals(plugin?.pluginData?.get("foo"), "bar");

  assertEquals(plugin?.extensionDescriptors.length, 1);

  const extensionDescriptor = plugin?.extensionDescriptors[0];

  assertEquals(extensionDescriptor?.extensionData?.get("foo"), "bar");

  await extensionDescriptor?.factory.create();
});
