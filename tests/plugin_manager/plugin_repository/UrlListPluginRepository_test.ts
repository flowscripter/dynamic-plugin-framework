import { assertEquals, assertThrows, path } from "../../test_deps.ts";
import UrlListPluginRepository from "../../../src/plugin_manager/plugin_repository/UrlListPluginRepository.ts";
import {
  EXTENSION_POINT_1,
  EXTENSION_POINT_2,
} from "../../fixtures/Constants.ts";

const PLUGIN_1_URL = "file://" +
  path.join(
    path.dirname(path.fromFileUrl(import.meta.url)),
    "../../fixtures/ValidPlugin1.ts",
  );

Deno.test("Throws on empty set of URLs", () => {
  assertThrows(() => new UrlListPluginRepository(new Set()));
});

Deno.test("Throws on invalid URL", () => {
  assertThrows(() => new UrlListPluginRepository(new Set("foo")));
});

Deno.test("Successfully scans for matching plugin", async () => {
  const urlSet = new Set<string>();
  urlSet.add(PLUGIN_1_URL);

  const pluginRepository = new UrlListPluginRepository(urlSet);

  let count = 0;
  for await (
    const extensionEntry of pluginRepository.scanForExtensions(
      EXTENSION_POINT_1,
    )
  ) {
    assertEquals(extensionEntry.pluginId, PLUGIN_1_URL);
    assertEquals(extensionEntry.extensionPoint, EXTENSION_POINT_1);
    count += 1;
  }
  assertEquals(count, 1);
});

Deno.test("Successfully scans for non-matching plugin", async () => {
  const urlSet = new Set<string>();
  urlSet.add(PLUGIN_1_URL);

  const pluginRepository = new UrlListPluginRepository(urlSet);

  let count = 0;
  for await (
    const extensionEntry of pluginRepository.scanForExtensions(
      EXTENSION_POINT_2,
    )
  ) {
    // this should not be called
    assertEquals(extensionEntry.pluginId, "not good");
    count += 1;
  }
  assertEquals(count, 0);
});
