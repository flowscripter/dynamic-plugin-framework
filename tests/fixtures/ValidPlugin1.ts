import type Plugin from "../../src/api/plugin/Plugin.ts";
import type ExtensionDescriptor from "../../src/api/plugin/ExtensionDescriptor.ts";
import type ExtensionFactory from "../../src/api/plugin/ExtensionFactory.ts";
import { EXTENSION_POINT_1, type ExtensionPoint1 } from "./Constants.ts";

const extension1: ExtensionPoint1 = {
  sayHello: () => {
    return "hello";
  },
};

const extensionFactory1: ExtensionFactory = {
  create: () => {
    return Promise.resolve(extension1);
  },
};

export const extensionDescriptor1: ExtensionDescriptor = {
  extensionPoint: EXTENSION_POINT_1,

  factory: extensionFactory1,

  extensionData: new Map([["foo", "bar"]]),
};

const plugin1: Plugin = {
  pluginData: new Map([["foo", "bar"]]),

  extensionDescriptors: [
    extensionDescriptor1,
  ],
};

export default plugin1;
