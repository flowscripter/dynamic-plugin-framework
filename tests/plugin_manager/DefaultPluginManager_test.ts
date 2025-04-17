import { describe, expect, test } from "bun:test";
import path from "node:path";
import DefaultPluginManager from "../../src/plugin_manager/DefaultPluginManager.ts";
import UrlListPluginRepository from "../../src/plugin_manager/plugin_repository/UrlListPluginRepository.ts";
import {
  EXTENSION_POINT_1,
  type ExtensionPoint1,
} from "../fixtures/Constants.ts";

const PLUGIN_1_URL = "file://" +
  path.join(
    path.dirname(Bun.fileURLToPath(import.meta.url)),
    "../fixtures/ValidPlugin1.ts",
  );

describe("DefaultPluginManager Tests", () => {
  test("Register without a plugin repository does not fail", async () => {
    const defaultPluginManager = new DefaultPluginManager([]);

    await defaultPluginManager.registerExtensions(EXTENSION_POINT_1);
  });

  test("Successfully register extension point", async () => {
    const urlListPluginRepository = new UrlListPluginRepository(
      new Set([{ url: PLUGIN_1_URL, extensionPoints: [EXTENSION_POINT_1] }]),
    );
    const defaultPluginManager = new DefaultPluginManager([
      urlListPluginRepository,
    ]);

    let extensions = await defaultPluginManager.getRegisteredExtensions(
      EXTENSION_POINT_1,
    );

    expect(extensions.length).toEqual(0);

    await defaultPluginManager.registerExtensions(EXTENSION_POINT_1);

    extensions = await defaultPluginManager.getRegisteredExtensions(
      EXTENSION_POINT_1,
    );

    expect(extensions.length).toEqual(1);
  });

  test("Registering an extension point twice has no effect", async () => {
    const urlListPluginRepository = new UrlListPluginRepository(
      new Set([{ url: PLUGIN_1_URL, extensionPoints: [EXTENSION_POINT_1] }]),
    );
    const defaultPluginManager = new DefaultPluginManager([
      urlListPluginRepository,
    ]);

    await defaultPluginManager.registerExtensions(EXTENSION_POINT_1);

    let extensions = await defaultPluginManager.getRegisteredExtensions(
      EXTENSION_POINT_1,
    );

    expect(extensions.length).toEqual(1);

    await defaultPluginManager.registerExtensions(EXTENSION_POINT_1);

    extensions = await defaultPluginManager.getRegisteredExtensions(
      EXTENSION_POINT_1,
    );

    expect(extensions.length).toEqual(1);
  });

  test("Instantiating an extension works", async () => {
    const urlListPluginRepository = new UrlListPluginRepository(
      new Set([{ url: PLUGIN_1_URL, extensionPoints: [EXTENSION_POINT_1] }]),
    );
    const defaultPluginManager = new DefaultPluginManager([
      urlListPluginRepository,
    ]);

    await defaultPluginManager.registerExtensions(EXTENSION_POINT_1);

    const extensionInfos = await defaultPluginManager.getRegisteredExtensions(
      EXTENSION_POINT_1,
    );

    const extensionInfo = extensionInfos[0];

    expect(extensionInfo.pluginData?.get("foo"), "bar");
    expect(extensionInfo.extensionData?.get("foo"), "bar");

    const instance = await defaultPluginManager.instantiate(
      extensionInfo.extensionHandle,
    ) as ExtensionPoint1;

    expect(instance.sayHello()).toEqual("hello");
  });
});
