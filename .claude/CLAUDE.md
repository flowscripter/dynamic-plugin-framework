# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`@flowscripter/dynamic-plugin-framework` - Dynamic plugin framework for Bun based on Javascript Modules and `import()`. Provides runtime discovery and loading of plugins via extension points, modeled on Eclipse's extension framework. Supports Bun and browser runtimes.

## Commands

```bash
# Install
bun install

# Test
bun test

# Format (auto-fixes in place)
bunx oxfmt

# Lint
bunx oxlint index.ts plugin.ts src/ tests/

# Generate HTML API docs
bunx typedoc --readme none index.ts

# Type check
bunx tsc --noEmit
```

## Entry points

The package has two subpath exports targeting different audiences:

- `@flowscripter/dynamic-plugin-framework` (`index.ts`) -- full API for host application authors; includes all interfaces and the two concrete implementations
- `@flowscripter/dynamic-plugin-framework/plugin` (`plugin.ts`) -- plugin author API only; exports `Plugin`, `ExtensionDescriptor`, `ExtensionFactory` without pulling in host implementation

## Architecture

- `index.ts` -- host application entry point; re-exports all interfaces and the two concrete implementations
- `plugin.ts` -- plugin author entry point; re-exports only the three plugin-side interfaces
- `src/api/plugin/` -- `Plugin`, `ExtensionDescriptor`, `ExtensionFactory` interfaces (implemented by plugin authors)
- `src/api/plugin_manager/` -- `PluginManager`, `ExtensionInfo` interfaces (consumed by host applications)
- `src/plugin_manager/DefaultPluginManager.ts` -- concrete `PluginManager` implementation; owns registries and repositories
- `src/plugin_manager/plugin_repository/` -- `PluginRepository` interface, `UrlListPluginRepository` (scans URL lists for plugins), `UrlPluginSource`, `ExtensionEntry`
- `src/plugin_manager/registry/` -- `ExtensionPointRegistry` / `ExtensionRegistry` interfaces and `InMemory*` implementations
- `src/plugin_manager/util/PluginLoader.ts` -- dynamic `import()` helper used by repositories; preflights fetched bundles and checks `Plugin.sharedModules` ranges
- `src/shared/SharedModules.ts` -- process-global registry (`registerSharedModules` via Bun virtual modules, `describeSharedModules` for browsers); `src/shared/Runtime.ts` -- `isBunRuntime()` (spied in tests; the `Bun` global cannot be stubbed)
- `tests/fixtures/` -- valid and invalid plugin fixtures used by unit tests
- `tests/plugin_manager/` -- unit tests mirroring the `src/plugin_manager/` structure

### Key flow

1. Host calls `pluginManager.registerExtensions(EXTENSION_POINT_ID)` -- scans all repositories
2. Host calls `pluginManager.getRegisteredExtensions(EXTENSION_POINT_ID)` -- returns `ExtensionInfo[]`
3. Host selects an entry and calls `pluginManager.instantiate(handle, hostData)` -- dynamic imports plugin, invokes factory
