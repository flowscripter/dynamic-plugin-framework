import { describe, expect, test } from "bun:test";
import loadPlugin from "../../../src/plugin_manager/util/PluginLoader.ts";

describe("PluginLoader Tests", () => {
  test("Rejects invalid URL", async () => {
    const pluginLoadResult = await loadPlugin("foo");

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.message).toStartWith("Cannot find package");
  });

  test("Rejects invalid modules", async () => {
    const pluginLoadResult = await loadPlugin(
      "../plugin_repository/UrlListPluginRepository.ts",
    );

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(
      pluginLoadResult.error?.message,
    ).toEqual(
      "Plugin from ../plugin_repository/UrlListPluginRepository.ts does not provide an extensionDescriptors array",
    );
  });

  test("Rejects invalid plugins", async () => {
    let pluginLoadResult = await loadPlugin(
      "../../../tests/fixtures/InvalidPlugin1.ts",
    );

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.name).toEqual("Error");
    expect(
      pluginLoadResult.error?.message,
    ).toEqual(
      "Plugin from ../../../tests/fixtures/InvalidPlugin1.ts does not provide an extensionDescriptors array",
    );

    pluginLoadResult = await loadPlugin(
      "../../../tests/fixtures/InvalidPlugin2.ts",
    );

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.name).toEqual("Error");
    expect(
      pluginLoadResult.error?.message,
    ).toEqual(
      "Plugin from ../../../tests/fixtures/InvalidPlugin2.ts does not provide an extensionPoint string in one of the extensionDescriptors",
    );

    pluginLoadResult = await loadPlugin(
      "../../../tests/fixtures/InvalidPlugin3.ts",
    );

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.name).toEqual("Error");
    expect(
      pluginLoadResult.error?.message,
    ).toEqual(
      "Plugin from ../../../tests/fixtures/InvalidPlugin3.ts does not provide a factory with a create function in one of the extensionDescriptors",
    );

    pluginLoadResult = await loadPlugin(
      "../../../tests/fixtures/InvalidPlugin4.ts",
    );

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.name).toEqual("Error");
    expect(
      pluginLoadResult.error?.message,
    ).toEqual(
      "Plugin from ../../../tests/fixtures/InvalidPlugin4.ts does not provide a factory with a create function in one of the extensionDescriptors",
    );

    pluginLoadResult = await loadPlugin(
      "../../../tests/fixtures/InvalidPlugin5.ts",
    );

    expect(pluginLoadResult.isValidPlugin).toBeFalse();
    expect(pluginLoadResult.error?.name).toEqual("Error");
    expect(
      pluginLoadResult.error?.message,
    ).toEqual(
      "Plugin from ../../../tests/fixtures/InvalidPlugin5.ts does not provide a factory with a create function in one of the extensionDescriptors",
    );
  });

  test("Returns valid plugin", async () => {
    const pluginLoadResult = await loadPlugin(
      "../../../tests/fixtures/ValidPlugin1.ts",
    );

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
