import { describe, expect, test } from "bun:test";
import InMemoryExtensionRegistry from "../../../src/plugin_manager/registry/InMemoryExtensionRegistry.ts";
import type ExtensionEntry from "../../../src/plugin_manager/plugin_repository/ExtensionEntry.ts";

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

describe("InMemoryExtensionRegistry Tests", () => {
  test("Register extension", async () => {
    const extensionRegistry = new InMemoryExtensionRegistry();

    expect(extensionRegistry.get(EXTENSION_1_HANDLE)).rejects
      .toThrow();

    await extensionRegistry.register(EXTENSION_1_HANDLE, extensionEntry1);

    await extensionRegistry.get(EXTENSION_1_HANDLE);
  });

  test("Cannot register extension twice", async () => {
    const extensionRegistry = new InMemoryExtensionRegistry();

    await extensionRegistry.register(EXTENSION_1_HANDLE, extensionEntry1);

    expect(extensionRegistry.register(EXTENSION_1_HANDLE, extensionEntry1))
      .rejects.toThrow();
  });

  test("Get registered extensions", async () => {
    const extensionRegistry = new InMemoryExtensionRegistry();

    await extensionRegistry.register(EXTENSION_1_HANDLE, extensionEntry1);
    await extensionRegistry.register(EXTENSION_2_HANDLE, extensionEntry2);

    const extensionEntries1 = await extensionRegistry.getExtensions(
      EXTENSION_POINT_1,
    );

    expect(extensionEntries1.size).toEqual(1);
    expect(
      extensionEntries1.get(EXTENSION_1_HANDLE)?.extensionId,
    ).toEqual(EXTENSION_1_ID);

    const extensionEntries2 = await extensionRegistry.getExtensions(
      EXTENSION_POINT_2,
    );

    expect(extensionEntries2.size).toEqual(1);
    expect(
      extensionEntries2.get(EXTENSION_2_HANDLE)?.extensionId,
    ).toEqual(EXTENSION_2_ID);
  });
});
