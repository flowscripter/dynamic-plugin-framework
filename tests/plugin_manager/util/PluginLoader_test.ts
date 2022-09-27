import { assert, assertEquals, assertFalse } from "../../test_deps.ts";
import loadPlugin from "../../../src/plugin_manager/util/PluginLoader.ts";

Deno.test("Rejects invalid URL", async () => {
  const pluginLoadResult = await loadPlugin("foo");

  assertFalse(pluginLoadResult.isValidPlugin);
  assertEquals(pluginLoadResult.error?.name, "TypeError");
});

Deno.test("Rejects invalid modules", async () => {
  let pluginLoadResult = await loadPlugin(
    "../plugin_repository/ExtensionEntry.ts",
  );

  assertFalse(pluginLoadResult.isValidPlugin);
  assertEquals(pluginLoadResult.error?.name, "Error");
  assertEquals(
    pluginLoadResult.error?.message,
    "Default export of module ../plugin_repository/ExtensionEntry.ts is not a Plugin constructor",
  );

  pluginLoadResult = await loadPlugin("./PluginLoader.ts");

  assertFalse(pluginLoadResult.isValidPlugin);
  assertEquals(pluginLoadResult.error?.name, "TypeError");
  assertEquals(
    pluginLoadResult.error?.message,
    "PotentialPlugin is not a constructor",
  );

  pluginLoadResult = await loadPlugin(
    "../plugin_repository/UrlListPluginRepository.ts",
  );

  assertFalse(pluginLoadResult.isValidPlugin);
  assertEquals(pluginLoadResult.error?.name, "Error");
  assertEquals(
    pluginLoadResult.error?.message,
    "Undefined or empty set of URLs provided",
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
  assertEquals(pluginLoadResult.instance?.extensionDescriptors.length, 1);

  await pluginLoadResult.instance?.extensionDescriptors[0].factory.create();
});
