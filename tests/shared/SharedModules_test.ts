import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as Runtime from "../../src/shared/Runtime.ts";
import {
  describeSharedModules,
  getSharedModule,
  isSharedModuleRegistered,
  registerSharedModules,
} from "../../src/shared/SharedModules.ts";

class SharedError extends Error {}

const resolveSpecifier: string = "sm-test-resolve";
const subSpecifier: string = "sm-test-sub/extra";

describe("SharedModules Tests", () => {
  test("Registered module is resolved by import and shares class identity", async () => {
    registerSharedModules({
      "sm-test-resolve": { version: "1.2.3", exports: { SharedError } },
    });

    const mod = await import(resolveSpecifier);

    expect(mod.SharedError).toBe(SharedError);
    expect(new mod.SharedError() instanceof SharedError).toBeTrue();
    expect(isSharedModuleRegistered("sm-test-resolve")).toBeTrue();
    expect(getSharedModule("sm-test-resolve")).toEqual({ version: "1.2.3" });
  });

  test("Registering the same exports object again is a no-op", () => {
    const exports = { a: 1 };
    registerSharedModules({ "sm-test-same": { exports } });
    registerSharedModules({ "sm-test-same": { exports } });

    expect(isSharedModuleRegistered("sm-test-same")).toBeTrue();
  });

  test("Registering a different exports object for a specifier throws", () => {
    registerSharedModules({ "sm-test-conflict": { exports: { a: 1 } } });

    expect(() => registerSharedModules({ "sm-test-conflict": { exports: { a: 2 } } })).toThrow(
      "Shared module 'sm-test-conflict' is already registered with a different exports object",
    );
  });

  test("Subpaths are matched exactly and must be registered separately", async () => {
    registerSharedModules({ "sm-test-sub": { exports: { root: true } } });

    expect(isSharedModuleRegistered("sm-test-sub/extra")).toBeFalse();

    registerSharedModules({ "sm-test-sub/extra": { exports: { extra: true } } });

    expect(((await import(subSpecifier)) as { extra: boolean }).extra).toBeTrue();
  });

  test("describeSharedModules declares versions without registering a module", () => {
    describeSharedModules({ "sm-test-described": "4.5.6" });

    expect(isSharedModuleRegistered("sm-test-described")).toBeFalse();
    expect(getSharedModule("sm-test-described")).toEqual({ version: "4.5.6" });
    expect(getSharedModule("sm-test-unknown")).toBeUndefined();
  });

  describe("without Bun", () => {
    let spy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      spy = spyOn(Runtime, "isBunRuntime").mockReturnValue(false);
    });

    afterEach(() => {
      spy.mockRestore();
    });

    test("registerSharedModules throws", () => {
      expect(() => registerSharedModules({ "sm-test-nobun": { exports: {} } })).toThrow(
        "registerSharedModules requires Bun; in a browser use an import map",
      );
    });
  });
});
