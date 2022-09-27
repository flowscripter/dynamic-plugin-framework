/**
 * A factory interface to create an Extension implementing an Extension Point.
 */
export default interface ExtensionFactory {
  /**
   * Construct and return an instance of an Extension implementing an Extension Point.
   *
   * @param hostData optional host application data to pass into the the Extension constructor.
   *
   * @return an Extension instance implementing an Extension Point.
   */
  create(hostData?: Map<string, string>): Promise<unknown>;
}
