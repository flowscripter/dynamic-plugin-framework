/**
 * A registry of Extension Points.
 */
export default interface ExtensionPointRegistry {
  /**
   * Register a specified Extension Point.
   *
   * @param extensionPoint the Extension Point to register
   */
  register(extensionPoint: string): Promise<void>;

  /**
   * Return all registered Extension Points.
   *
   * @return Set of Extension Points
   */
  getAll(): Promise<ReadonlySet<string>>;

  /**
   * Returns *true* if the specified Extension Point has been registered.
   *
   * @param extensionPoint the Extension Point to check
   */
  isRegistered(extensionPoint: string): Promise<boolean>;
}
