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

**Host application authors** import from the main entry point, which exposes
the full API including concrete implementations. For example:

```typescript
import {
  DefaultPluginManager,
  NpmjsPluginRepository,
  NpmPluginInstaller,
  NpmPluginRepository,
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

`PluginInstaller` provides the base install/uninstall contract. `VersionedPluginInstaller` extends it with dependency-aware install, a dependent-safety guard on uninstall, and update checking:

```mermaid
classDiagram
    class PluginInstaller {
        <<interface>>
        install(descriptor, source, target) void
        uninstall(pluginId, target) void
    }

    class VersionedPluginInstaller {
        <<interface>>
        install(descriptor, source, target, options?) void
        uninstall(pluginId, target) void
        checkForUpdates(local, remote) AsyncIterable~UpdateInfo~
    }

    class HttpPluginInstaller {
        install: fetches bundle, writes to LocalFolderPluginRepository
        uninstall: removes bundle and manifest entry
    }

    class NpmPluginInstaller {
        constructor(installCommand?)
        install: shells out to bun add / npm install
        uninstall: shells out to bun remove
    }

    PluginInstaller <|-- VersionedPluginInstaller
    VersionedPluginInstaller <|.. HttpPluginInstaller
    VersionedPluginInstaller <|.. NpmPluginInstaller
```

## PluginManager API

`DefaultPluginManager` handles standard plugin discovery and instantiation. `MarketplacePluginManager` extends the `PluginManager` API with search and install, delegating standard manager methods to an internal `DefaultPluginManager` backed by the local repository:

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
    }

    class DefaultPluginManager {
        constructor(repos, extensionPointRegistry?, extensionRegistry?)
    }

    class NpmPluginManager {
        constructor(remotes[], local, installer)
    }

    class HttpPluginManager {
        constructor(remotes[], local, installer)
    }

    PluginManager <|.. DefaultPluginManager
    PluginManager <|-- MarketplacePluginManager
    MarketplacePluginManager <|.. NpmPluginManager
    MarketplacePluginManager <|.. HttpPluginManager
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
    participant Installer as NpmPluginInstaller
    participant LocalRepo as NpmPluginRepository

    HostApp->>Manager: new NpmPluginManager([npmjsRepo], localRepo, installer)
    HostApp->>Manager: search({ text: "my-plugin" })
    activate Manager
    Manager->>NPMRepo: search({ text: "my-plugin" })
    NPMRepo-->>Manager: VersionedPluginDescriptor[]
    Manager-->>HostApp: VersionedPluginDescriptor[]
    deactivate Manager
    HostApp->>Manager: install(descriptor, { includeDependencies: true })
    activate Manager
    Manager->>Installer: install(descriptor, npmjsRepo, localRepo, options)
    Installer->>Installer: bun add <package>
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
    Manager->>Repo: getExtensionDescriptorFromExtensionEntry(entry)
    Repo-->>Manager: ExtensionDescriptor
    Manager->>Manager: factory.create()
    Manager-->>HostApp: Extension instance
    deactivate Manager
```
