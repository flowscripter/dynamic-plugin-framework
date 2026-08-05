/**
 * Outcome of a {@link SpawnInterface.spawn} call.
 *
 * `ok` is `true` only when the process launched and exited with code `0`. A launch failure (e.g.
 * the binary was not found) sets `error` with no `exitCode`; a non-zero exit sets `exitCode` with
 * no `error`; a process that did not exit within `options.timeoutMs` sets `timedOut` with no
 * `error`/`exitCode`.
 */
export interface SpawnResult {
  ok: boolean;
  exitCode?: number;
  error?: Error;
  timedOut?: boolean;
}

/**
 * Allows a host application to supply its own process-spawning implementation (e.g. one which
 * integrates with a CLI framework's shutdown handling and output rendering) instead of a
 * {@link PluginManager} shelling out directly.
 */
export default interface SpawnInterface {
  /**
   * Spawn a process and wait for it to exit.
   *
   * @param command the command and its arguments, e.g. `["bun", "add", "some-package"]`.
   * @param options.cwd the working directory for the spawned process.
   * @param options.timeoutMs if specified, the process is killed and {@link SpawnResult.timedOut}
   * is set if it has not exited within this many milliseconds. Defaults to unbounded.
   *
   * @return the {@link SpawnResult}. Never rejects.
   */
  spawn(
    command: ReadonlyArray<string>,
    options: { cwd: string; timeoutMs?: number },
  ): Promise<SpawnResult>;
}
