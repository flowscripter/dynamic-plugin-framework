import { describe, expect, test } from "bun:test";
import path from "node:path";
import UrlListPluginRepository from "../../../src/plugin_manager/plugin_repository/UrlListPluginRepository.ts";
import {
  EXTENSION_POINT_1,
  EXTENSION_POINT_2,
} from "../../fixtures/Constants.ts";

const PLUGIN_1_URL = "file://" +
  path.join(
    path.dirname(Bun.fileURLToPath(import.meta.url)),
    "../../fixtures/ValidPlugin1.ts",
  );

describe("UrlPluginSource Tests", () => {
  test("Throws on empty set of URLs", () => {
    expect(() => new UrlListPluginRepository(new Set())).toThrow();
  });

  test("Throws on invalid URL", () => {
    expect(() =>
      new UrlListPluginRepository(
        new Set([{ url: "foo", extensionPoints: ["bar"] }]),
      )
    ).toThrow();
  });

  test("Successfully scans for matching plugin", async () => {
    const urlSet = new Set<{ url: string; extensionPoints: string[] }>();
    urlSet.add({ url: PLUGIN_1_URL, extensionPoints: [EXTENSION_POINT_1] });

    const pluginRepository = new UrlListPluginRepository(urlSet);

    let count = 0;
    for await (
      const extensionEntry of pluginRepository.scanForExtensions(
        EXTENSION_POINT_1,
      )
    ) {
      expect(extensionEntry.pluginId).toEqual(PLUGIN_1_URL);
      expect(extensionEntry.extensionPoint).toEqual(EXTENSION_POINT_1);
      count += 1;
    }
    expect(count).toEqual(1);
  });

  test("Successfully scans for non-matching plugin", async () => {
    const urlSet = new Set<{ url: string; extensionPoints: string[] }>();
    urlSet.add({ url: PLUGIN_1_URL, extensionPoints: [EXTENSION_POINT_1] });

    const pluginRepository = new UrlListPluginRepository(urlSet);

    let count = 0;
    for await (
      const extensionEntry of pluginRepository.scanForExtensions(
        EXTENSION_POINT_2,
      )
    ) {
      // this should not be called
      expect(extensionEntry.pluginId, "not good");
      count += 1;
    }
    expect(count).toEqual(0);
  });
});
