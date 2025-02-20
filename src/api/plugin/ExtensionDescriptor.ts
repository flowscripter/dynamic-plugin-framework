import type ExtensionFactory from "./ExtensionFactory.ts";

/**
 * Provides details of an Extension implementing an Extension Point.
 */
export default interface ExtensionDescriptor {
  /**
   * The implemented Extension Point
   */
  readonly extensionPoint: string;

  /**
   * Optional data provided by the Extension to the host application
   */
  readonly extensionData?: ReadonlyMap<string, string>;

  /**
   * An {@link ExtensionFactory} which can be used to create an instance of an Extension which implements
   * the Extension Point.
   */
  readonly factory: ExtensionFactory;
}
