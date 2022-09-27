import { assert, assertFalse, assertRejects } from "../../test_deps.ts";
import InMemoryExtensionPointRegistry from "../../../src/plugin_manager/registry/InMemoryExtensionPointRegistry.ts";
import {
  EXTENSION_POINT_1,
  EXTENSION_POINT_2,
} from "../../fixtures/Constants.ts";

Deno.test("Register extension point", async () => {
  const extensionPointRegistry = new InMemoryExtensionPointRegistry();

  assertFalse(await extensionPointRegistry.isRegistered(EXTENSION_POINT_1));

  await extensionPointRegistry.register(EXTENSION_POINT_1);

  assert(await extensionPointRegistry.isRegistered(EXTENSION_POINT_1));
});

Deno.test("Cannot register extension point twice", async () => {
  const extensionPointRegistry = new InMemoryExtensionPointRegistry();

  await extensionPointRegistry.register(EXTENSION_POINT_1);

  await assertRejects(() => extensionPointRegistry.register(EXTENSION_POINT_1));
});

Deno.test("Get registered extension points", async () => {
  const extensionPointRegistry = new InMemoryExtensionPointRegistry();

  await extensionPointRegistry.register(EXTENSION_POINT_1);
  await extensionPointRegistry.register(EXTENSION_POINT_2);

  const extensionPoints = await extensionPointRegistry.getAll();

  assert(extensionPoints.has(EXTENSION_POINT_1));
  assert(extensionPoints.has(EXTENSION_POINT_2));
});
