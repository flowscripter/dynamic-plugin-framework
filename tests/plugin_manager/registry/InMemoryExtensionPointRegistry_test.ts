import { describe, expect, test } from "bun:test";
import InMemoryExtensionPointRegistry from "../../../src/plugin_manager/registry/InMemoryExtensionPointRegistry.ts";
import {
  EXTENSION_POINT_1,
  EXTENSION_POINT_2,
} from "../../fixtures/Constants.ts";

describe("InMemoryExtensionPointRegistry Tests", () => {
  test("Register extension point", async () => {
    const extensionPointRegistry = new InMemoryExtensionPointRegistry();

    expect(await extensionPointRegistry.isRegistered(EXTENSION_POINT_1))
      .toBeFalse();

    await extensionPointRegistry.register(EXTENSION_POINT_1);

    expect(await extensionPointRegistry.isRegistered(EXTENSION_POINT_1))
      .toBeTrue();
  });

  test("Cannot register extension point twice", async () => {
    const extensionPointRegistry = new InMemoryExtensionPointRegistry();

    await extensionPointRegistry.register(EXTENSION_POINT_1);

    expect(extensionPointRegistry.register(EXTENSION_POINT_1))
      .rejects.toThrow();
  });

  test("Get registered extension points", async () => {
    const extensionPointRegistry = new InMemoryExtensionPointRegistry();

    await extensionPointRegistry.register(EXTENSION_POINT_1);
    await extensionPointRegistry.register(EXTENSION_POINT_2);

    const extensionPoints = await extensionPointRegistry.getAll();

    expect(extensionPoints.has(EXTENSION_POINT_1)).toBeTrue();
    expect(extensionPoints.has(EXTENSION_POINT_2)).toBeTrue();
  });
});
