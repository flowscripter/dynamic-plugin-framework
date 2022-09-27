import Plugin from "../../src/api/plugin/Plugin.ts";
import ExtensionDescriptor from "../../src/api/plugin/ExtensionDescriptor.ts";
import ExtensionFactory from "../../src/api/plugin/ExtensionFactory.ts";
import { EXTENSION_POINT_1, ExtensionPoint1 } from "./Constants.ts";

class Extension1 implements ExtensionPoint1 {
  public sayHello(): string {
    return "hello";
  }
}

class ExtensionFactory1 implements ExtensionFactory {
  public create(): Promise<unknown> {
    return Promise.resolve(new Extension1());
  }
}

export class ExtensionDescriptor1 implements ExtensionDescriptor {
  public extensionPoint: string = EXTENSION_POINT_1;

  public factory: ExtensionFactory = new ExtensionFactory1();
}

export default class Plugin1 implements Plugin {
  public extensionDescriptors: ExtensionDescriptor[] = [
    new ExtensionDescriptor1(),
  ];
}
