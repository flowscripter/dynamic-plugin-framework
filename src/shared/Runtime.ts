/**
 * @returns `true` if running under Bun, `false` for other runtimes such as a browser.
 */
export function isBunRuntime(): boolean {
  return typeof Bun !== "undefined" && typeof Bun.plugin === "function";
}
