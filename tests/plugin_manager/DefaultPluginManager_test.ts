import { assertEquals, path } from "../test_deps.ts";
import DefaultPluginManager from "../../src/plugin_manager/DefaultPluginManager.ts";
import UrlListPluginRepository from "../../src/plugin_manager/plugin_repository/UrlListPluginRepository.ts";
import { EXTENSION_POINT_1, ExtensionPoint1 } from "../fixtures/Constants.ts";

const PLUGIN_1_URL = "file://" +
  path.join(
    path.dirname(path.fromFileUrl(import.meta.url)),
    "../fixtures/ValidPlugin1.ts",
  );

Deno.test("Register without a plugin repository does not fail", async () => {
  const defaultPluginManager = new DefaultPluginManager([]);

  await defaultPluginManager.registerExtensions(EXTENSION_POINT_1);
});

Deno.test("Successfully register extension point", async () => {
  const urlListPluginRepository = new UrlListPluginRepository(
    new Set([PLUGIN_1_URL]),
  );
  const defaultPluginManager = new DefaultPluginManager([
    urlListPluginRepository,
  ]);

  let extensions = await defaultPluginManager.getRegisteredExtensions(
    EXTENSION_POINT_1,
  );

  assertEquals(extensions.length, 0);

  await defaultPluginManager.registerExtensions(EXTENSION_POINT_1);

  extensions = await defaultPluginManager.getRegisteredExtensions(
    EXTENSION_POINT_1,
  );

  assertEquals(extensions.length, 1);
});

Deno.test("Registering an extension point twice has no effect", async () => {
  const urlListPluginRepository = new UrlListPluginRepository(
    new Set([PLUGIN_1_URL]),
  );
  const defaultPluginManager = new DefaultPluginManager([
    urlListPluginRepository,
  ]);

  await defaultPluginManager.registerExtensions(EXTENSION_POINT_1);

  let extensions = await defaultPluginManager.getRegisteredExtensions(
    EXTENSION_POINT_1,
  );

  assertEquals(extensions.length, 1);

  await defaultPluginManager.registerExtensions(EXTENSION_POINT_1);

  extensions = await defaultPluginManager.getRegisteredExtensions(
    EXTENSION_POINT_1,
  );

  assertEquals(extensions.length, 1);
});

Deno.test("Instantiating an extension works", async () => {
  const urlListPluginRepository = new UrlListPluginRepository(
    new Set([PLUGIN_1_URL]),
  );
  const defaultPluginManager = new DefaultPluginManager([
    urlListPluginRepository,
  ]);

  await defaultPluginManager.registerExtensions(EXTENSION_POINT_1);

  const extensions = await defaultPluginManager.getRegisteredExtensions(
    EXTENSION_POINT_1,
  );

  const desiredExtension = extensions[0];

  const instance = await defaultPluginManager.instantiate(
    desiredExtension.extensionHandle,
  ) as ExtensionPoint1;

  assertEquals(instance.sayHello(), "hello");
});
