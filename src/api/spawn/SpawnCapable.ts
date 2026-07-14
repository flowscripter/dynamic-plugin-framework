import type SpawnInterface from "./SpawnInterface.ts";

/**
 * Implemented by {@link PluginManager} implementations which support having their process
 * spawning delegated to a host-supplied {@link SpawnInterface} instead of spawning directly.
 */
export default interface SpawnCapable {
  /**
   * Supply the {@link SpawnInterface} to delegate process spawning to.
   */
  setSpawn(spawn: SpawnInterface): void;
}
