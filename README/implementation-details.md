# Implementation Details

The package provides two entry points depending on your role:

**Plugin authors** only need the plugin-side interfaces. Import from the
`/plugin` subpath to keep the host implementation out of your module graph. For example:

```typescript
import type {
  Plugin,
  ExtensionDescriptor,
  ExtensionFactory,
  PluginDependency,
  VersionedPlugin,
} from "@flowscripter/dynamic-plugin-framework/plugin";
```

When building a plugin that will be consumed via `node_modules` (i.e.
installed as a dependency by a host application), don't bundle at all -
transpile with `tsc` instead:

```json
{
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "rewriteRelativeImportExtensions": true
  },
  "include": ["index.ts", "src/**/*.ts"]
}
```

This mirrors your source tree into `dist/`, rewrites relative `.ts` imports
to `.js`, and leaves bare specifiers (e.g.
`@flowscripter/dynamic-plugin-framework`, or
`@flowscripter/dynamic-cli-framework` for CLI plugins) completely untouched
so they resolve via `node_modules` at runtime. There's nothing to
externalize because nothing gets bundled: mark host-supplied packages as
`peerDependencies` in your `package.json` (this documents "the host
application is expected to have a compatible version installed") and let
regular `dependencies` (e.g. a helper library your plugin actually ships
with) resolve from `node_modules` the same way.

The one exception is a plugin meant to be a fully self-contained
distributable loaded via URL/CDN rather than `node_modules` (e.g.
`UrlListPluginRepository` fetches the bundle and dynamically imports it from
a local cache path outside any `node_modules` tree) - in that case full
bundling (e.g. `bun build`) is required, since there is no `node_modules` to
resolve an unbundled or externalized import against at that cache path. If a
host-supplied package is only ever referenced via `import type` (fully erased
at compile time, so nothing is emitted to bundle in the first place), it can
still be marked `--external` and `peerDependency` as a guardrail so a future
accidental value import fails loudly instead of silently duplicating the
host's runtime code into the bundle. Any package with a real value import
must stay bundled.

**Host application authors** import from the main entry point, which exposes
the full API including concrete implementations. For example:

```typescript
import {
  DefaultPluginManager,
  NpmjsPluginRepository,
  NpmPluginRepository,
  NpmPluginManager,
} from "@flowscripter/dynamic-plugin-framework";
import type { ExtensionInfo, PluginManager } from "@flowscripter/dynamic-plugin-framework";
```

## Plugin API

The following diagram provides an overview of the `Plugin` API:

```mermaid
classDiagram
    class Plugin {
        <<interface>>
        pluginData: any
    }

    class ExtensionDescriptor {
        <<interface>>
        extensionPoint
        extensionData: any
    }

    class ExtensionFactory {
        <<interface>>
        create(hostData: any) Extension
    }

    Plugin --> "1..*" ExtensionDescriptor: extensionDescriptors
    ExtensionDescriptor --> ExtensionFactory: factory
```

A `VersionedPlugin` extends `Plugin` with metadata that can be used by versioned repositories and installers without loading the plugin module:

```mermaid
classDiagram
    class Plugin {
        <<interface>>
        extensionDescriptors: ExtensionDescriptor[]
        pluginData: Map~string,string~
    }

    class VersionedPlugin {
        <<interface>>
        scope: string
        name: string
        version: string
        dependencies: PluginDependency[]
    }

    class PluginDependency {
        <<interface>>
        scope: string
        name: string
        versionRange: string
    }

    Plugin <|-- VersionedPlugin
    VersionedPlugin --> "0..*" PluginDependency : dependencies
```

## PluginRepository API

The framework provides a hierarchy of `PluginRepository` interfaces. The base interface is extended by `VersionedPluginRepository` (for repos with version metadata in a backing store) and further by `MarketplacePluginRepository` (for remote marketplaces):

```mermaid
classDiagram
    direction TB

    class PluginRepository {
        <<interface>>
        getPlugins() AsyncIterable~PluginDescriptor~
        scanForExtensions(extensionPoint) AsyncIterable~ExtensionEntry~
        getExtensionDescriptorFromExtensionEntry(entry) ExtensionDescriptor
    }

    class VersionedPluginRepository {
        <<interface>>
        getPlugins() AsyncIterable~VersionedPluginDescriptor~
    }

    class MarketplacePluginRepository {
        <<interface>>
        name: string
        description: string
        author: string
        url: string
        search(query) AsyncIterable~VersionedPluginDescriptor~
    }

    class UrlListPluginRepository {
        constructor(urlsAndExtensionPoints, cacheFolder?)
    }

    class NpmPluginRepository {
        constructor(nodeModulesPath, packageJsonNamespace)
    }

    class LocalFolderPluginRepository {
        constructor(pluginFolderPath, manifestFileName)
    }

    class NpmjsPluginRepository {
        constructor(name, registryUrl, packageJsonNamespace)
    }

    class HttpManifestPluginRepository {
        constructor(manifestUrl, name, cacheFolder)
    }

    PluginRepository <|-- VersionedPluginRepository
    PluginRepository <|-- UrlListPluginRepository
    VersionedPluginRepository <|-- MarketplacePluginRepository

    VersionedPluginRepository <|.. NpmPluginRepository
    VersionedPluginRepository <|.. LocalFolderPluginRepository
    MarketplacePluginRepository <|.. NpmjsPluginRepository
    MarketplacePluginRepository <|.. HttpManifestPluginRepository

    class PluginDescriptor {
        <<interface>>
        pluginId: string
        pluginData: Map~string,string~
        extensionPoints: string[]
    }

    class VersionedPluginDescriptor {
        <<interface>>
        scope: string
        name: string
        version: string
        dependencies: PluginDependency[]
    }

    PluginDescriptor <|-- VersionedPluginDescriptor
    PluginDescriptor <.. PluginRepository : yields
    VersionedPluginDescriptor <.. VersionedPluginRepository : yields
```

## PluginInstaller API

`PluginInstaller` provides the base install/uninstall contract for transferring plugins between repositories:

```mermaid
classDiagram
    class PluginInstaller {
        <<interface>>
        install(descriptor, source, target) void
        uninstall(pluginId, target) void
    }
```

## PluginManager API

`DefaultPluginManager` handles standard plugin discovery and instantiation. `MarketplacePluginManager` extends the `PluginManager` API with search, install, uninstall, and update checking, delegating standard manager methods to an internal `DefaultPluginManager` backed by the local repository:

```mermaid
classDiagram
    class PluginManager {
        <<interface>>
        registerExtensions(extensionPoint) void
        getRegisteredExtensions(extensionPoint) ExtensionInfo[]
        instantiate(handle, hostData?) Extension
    }

    class MarketplacePluginManager {
        <<interface>>
        search(query) AsyncIterable~VersionedPluginDescriptor~
        install(descriptor, options?) void
        uninstall(pluginId) void
        checkForUpdates(remote?) AsyncIterable~UpdateInfo~
    }

    class DefaultPluginManager {
        constructor(repos, extensionPointRegistry?, extensionRegistry?)
    }

    class DefaultMarketplacePluginManager {
        <<abstract>>
        constructor(remotes[], local, pluginManager?)
        checkForUpdates(remote?) AsyncIterable~UpdateInfo~
    }

    class NpmPluginManager {
        constructor(remotes[], local, opts?)
        install: shells out to installCommand (default "bun add", falling back to "npm install" if bun is not on PATH)
        uninstall: shells out to the matching remove command (e.g. "bun remove" / "npm uninstall")
    }

    class HttpPluginManager {
        constructor(remotes[], local)
        install: fetches bundle, writes to LocalFolderPluginRepository
        uninstall: removes bundle and manifest entry
    }

    PluginManager <|.. DefaultPluginManager
    PluginManager <|-- MarketplacePluginManager
    MarketplacePluginManager <|.. DefaultMarketplacePluginManager
    DefaultMarketplacePluginManager <|-- NpmPluginManager
    DefaultMarketplacePluginManager <|-- HttpPluginManager
    NpmPluginManager --> DefaultPluginManager : delegates PluginManager methods
    HttpPluginManager --> DefaultPluginManager : delegates PluginManager methods
```

## Plugin Discovery and Instantiation Flow

The following sequence diagram shows the flow for using `DefaultPluginManager` directly with a `UrlListPluginRepository`:

```mermaid
%%{init: { "sequence": { "mirrorActors":false }}}%%
sequenceDiagram
    participant HostApp
    participant Repo as UrlListPluginRepository
    participant Manager as DefaultPluginManager
    participant Plugin1

    HostApp->>Repo: new UrlListPluginRepository(urlsAndExtensionPoints)
    HostApp->>Manager: new DefaultPluginManager([repo])
    HostApp->>Manager: registerExtensions(EXTENSION_POINT)
    activate Manager
    Manager->>Repo: scanForExtensions(EXTENSION_POINT)
    Repo->>Plugin1: <<dynamic import>>
    Plugin1-->>Repo: Plugin
    Repo-->>Manager: ExtensionEntry[]
    deactivate Manager
    HostApp->>Manager: getRegisteredExtensions(EXTENSION_POINT)
    Manager-->>HostApp: ExtensionInfo[]
    HostApp->>Manager: instantiate(extensionHandle)
    activate Manager
    Manager->>Repo: getExtensionDescriptorFromExtensionEntry(entry)
    Repo-->>Manager: ExtensionDescriptor
    Manager->>Manager: factory.create()
    Manager-->>HostApp: Extension instance
    deactivate Manager
```

## Marketplace Plugin Discovery, Installation and Instantiation Flow

The following sequence diagram shows the flow for using `NpmPluginManager` to search, install, and instantiate plugins from the npm marketplace:

```mermaid
%%{init: { "sequence": { "mirrorActors":false }}}%%
sequenceDiagram
    participant HostApp
    participant NPMRepo as NpmjsPluginRepository
    participant Manager as NpmPluginManager
    participant LocalRepo as NpmPluginRepository

    HostApp->>Manager: new NpmPluginManager([npmjsRepo], localRepo)
    HostApp->>Manager: search({ text: "my-plugin" })
    activate Manager
    Manager->>NPMRepo: search({ text: "my-plugin" })
    NPMRepo-->>Manager: VersionedPluginDescriptor[]
    Manager-->>HostApp: VersionedPluginDescriptor[]
    deactivate Manager
    HostApp->>Manager: install(descriptor, { includeDependencies: true })
    activate Manager
    Manager->>Manager: bun add <package>
    deactivate Manager
    HostApp->>Manager: registerExtensions(EXTENSION_POINT)
    activate Manager
    Manager->>LocalRepo: scanForExtensions(EXTENSION_POINT)
    LocalRepo-->>Manager: ExtensionEntry[]
    deactivate Manager
    HostApp->>Manager: getRegisteredExtensions(EXTENSION_POINT)
    Manager-->>HostApp: ExtensionInfo[]
    HostApp->>Manager: instantiate(extensionHandle)
    activate Manager
    Manager->>LocalRepo: getExtensionDescriptorFromExtensionEntry(entry)
    LocalRepo-->>Manager: ExtensionDescriptor
    Manager->>Manager: factory.create()
    Manager-->>HostApp: Extension instance
    deactivate Manager
```
