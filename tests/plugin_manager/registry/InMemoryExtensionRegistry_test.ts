import { assert, assertRejects } from "../../test_deps.ts";
import InMemoryExtensionRegistry from "../../../src/plugin_manager/registry/InMemoryExtensionRegistry.ts";
import ExtensionEntry from "../../../src/plugin_manager/plugin_repository/ExtensionEntry.ts";
import { assertEquals } from "https://deno.land/std@0.147.0/testing/asserts.ts";

import {
  EXTENSION_1_HANDLE,
  EXTENSION_1_ID,
  EXTENSION_2_HANDLE,
  EXTENSION_2_ID,
  EXTENSION_POINT_1,
  EXTENSION_POINT_2,
  PLUGIN_1_ID,
  PLUGIN_2_ID,
} from "../../fixtures/Constants.ts";

const extensionEntry1: ExtensionEntry = {
  pluginId: PLUGIN_1_ID,
  extensionId: EXTENSION_1_ID,
  extensionPoint: EXTENSION_POINT_1,
};
const extensionEntry2: ExtensionEntry = {
  pluginId: PLUGIN_2_ID,
  extensionId: EXTENSION_2_ID,
  extensionPoint: EXTENSION_POINT_2,
};

Deno.test("Register extension", async () => {
  const extensionRegistry = new InMemoryExtensionRegistry();

  await assertRejects(() => extensionRegistry.get(EXTENSION_1_HANDLE));

  await extensionRegistry.register(EXTENSION_1_HANDLE, extensionEntry1);

  assert(await extensionRegistry.get(EXTENSION_1_HANDLE));
});

Deno.test("Cannot register extension twice", async () => {
  const extensionRegistry = new InMemoryExtensionRegistry();

  await extensionRegistry.register(EXTENSION_1_HANDLE, extensionEntry1);

  await assertRejects(() =>
    extensionRegistry.register(EXTENSION_1_HANDLE, extensionEntry1)
  );
});

Deno.test("Get registered extensions", async () => {
  const extensionRegistry = new InMemoryExtensionRegistry();

  await extensionRegistry.register(EXTENSION_1_HANDLE, extensionEntry1);
  await extensionRegistry.register(EXTENSION_2_HANDLE, extensionEntry2);

  const extensionEntries1 = await extensionRegistry.getExtensions(
    EXTENSION_POINT_1,
  );

  assertEquals(extensionEntries1.size, 1);
  assertEquals(
    extensionEntries1.get(EXTENSION_1_HANDLE)?.extensionId,
    EXTENSION_1_ID,
  );

  const extensionEntries2 = await extensionRegistry.getExtensions(
    EXTENSION_POINT_2,
  );

  assertEquals(extensionEntries2.size, 1);
  assertEquals(
    extensionEntries2.get(EXTENSION_2_HANDLE)?.extensionId,
    EXTENSION_2_ID,
  );
});
