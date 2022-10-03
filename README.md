# dynamic-plugin-framework

[![version](https://img.shields.io/github/v/release/flowscripter/dynamic-plugin-framework?sort=semver)](https://github.com/flowscripter/dynamic-plugin-framework/releases)
[![build](https://img.shields.io/github/workflow/status/flowscripter/dynamic-plugin-framework/release-deno-library)](https://github.com/flowscripter/dynamic-plugin-framework/actions/workflows/release-deno-library.yml)
[![coverage](https://codecov.io/gh/flowscripter/dynamic-plugin-framework/branch/main/graph/badge.svg?token=EMFT2938ZF)](https://codecov.io/gh/flowscripter/dynamic-plugin-framework)
[![dependencies](https://img.shields.io/endpoint?url=https%3A%2F%2Fdeno-visualizer.danopia.net%2Fshields%2Fupdates%2Fhttps%2Fraw.githubusercontent.com%2Fflowscripter%2Fdynamic-plugin-framework%2Fmain%2Fmod.ts)](https://github.com/flowscripter/dynamic-plugin-framework/blob/main/deps.ts)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https://deno.land/x/flowscripter_dynamic_plugin_framework/mod.ts)
[![license: MIT](https://img.shields.io/github/license/flowscripter/dynamic-plugin-framework)](https://github.com/flowscripter/dynamic-plugin-framework/blob/main/LICENSE)

> Dynamic plugin framework for Deno based on Javascript Modules and import()
> function.

## Overview

This project provides a framework for defining plugins which can be dynamically
discovered and imported into a running process.

#### Key Features

- Universal support for both Deno and browser runtimes
- Dynamic plugin import using
  [Javascript dynamic import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)
- ES2015 module based
- Written in Typescript

#### Key Concepts

The framework's key concepts are borrowed from the Eclipse Project's extension
framework. The key concepts are:

- A `Plugin` provides one or more `Extension` implementations.
- Each `Extension` implementation declares an `ExtensionPoint` identifier and an
  `ExtensionFactory` via an `ExtensionDescriptor`.
- A `HostApplication` instantiates a `PluginManager`.
- The `HostApplication` can register one or more `ExtensionPoint` identifiers
  that the `PluginManager` should be aware of.
- The `PluginManager` scans one or more `PluginRepository` implementations to
  find and register `Plugin` instances for any `ExtensionPoint` identifiers it
  is aware of.
- The `HostApplication` uses the `PluginManager` to query for and select an
  `Extension` for a desired `ExtensionPoint` identifier.
- The `PluginManager` uses the associated `ExtensionFactory` to instantiate the
  selected `Extension`.

The following high level class diagram illustrates these relationships:

```mermaid
classDiagram
    direction LR

    class HostApplication {
    }

    class ExtensionPoint1 {
        <<interface>>
        EXTENSION_POINT_1
    }

    class Plugin {
        <<interface>>
    }

    class PluginManager {
        <<interface>>
    }

    class PluginRepository {
        <<interface>>
    }

    class ExtensionDescriptor {
        <<interface>>
    }

    class ExtensionFactory {
        <<interface>>
    }

    class Plugin1 {
    }

    class Extension1Descriptor {
    }

    class Extension1Factory {
    }

    class Extension1 {
    }

    PluginRepository --> "0..*" Plugin
    PluginManager -->  "1..*" PluginRepository: scans
    Plugin --> "1..*" ExtensionDescriptor
    ExtensionDescriptor --> ExtensionFactory
    PluginManager --> "0..*" Plugin : registers
    PluginManager ..> ExtensionFactory : invokes
    Extension1Factory ..|> ExtensionFactory
    Extension1Descriptor ..|> ExtensionDescriptor
    Plugin1 ..|> Plugin
    Extension1 ..|> ExtensionPoint1
    Plugin1 --> Extension1Descriptor
    Extension1Descriptor --> Extension1Factory
    Extension1Factory ..> Extension1 : creates
    Extension1Descriptor ..> ExtensionPoint1: declares
    HostApplication --> PluginManager
    HostApplication ..> ExtensionPoint1: defines
```

The following sequence diagram illustrates the key steps for a `HostApplication`
to use a `PluginManager` for discovery and registration of `Plugin` instances:

```mermaid
%%{init: { "sequence": { "mirrorActors":false }}}%%
sequenceDiagram
    HostApplication->>PluginManager:<<static import>>
    Note over PluginRepository1,PluginRepository2: May use an index or scan plugins directly
    HostApplication->>PluginManager:registerExtensions(EXTENSION_POINT_1)
    activate PluginManager
    PluginManager->>PluginRepository1:scanForExtensions(EXTENSION_POINT_1)
    activate PluginRepository1
    PluginRepository1-->>PluginManager:ExtensionEntry[]
    deactivate PluginRepository1
    PluginManager->>PluginRepository2:scanForExtensions(EXTENSION_POINT_1)
    activate PluginRepository2
    PluginRepository2-->>PluginManager:ExtensionEntry[]
    deactivate PluginRepository2
    PluginManager-->>HostApplication:ExtensionInfo[]
    deactivate PluginManager
```

Once registration has been performed, the `HostApplication` may query the
`PluginManager` for `Extensions` of known `ExtensionPoints` and then instantiate
them:

```mermaid
%%{init: { "sequence": { "mirrorActors":false, diagramMarginY: 0 }}}%%
sequenceDiagram
    HostApplication->>PluginManager:getRegisteredExtensions(EXTENSION_POINT_1)
    activate PluginManager
    PluginManager->>PluginManager:filterExtensions
    PluginManager->>HostApplication:ExtensionInfo[]
    deactivate PluginManager
    HostApplication->>HostApplication:select Extension1
    HostApplication->>PluginManager:instantiate(extension1Handle)
    activate PluginManager
    PluginManager->>PluginRepository1:getExtensionDescriptorFromExtensionEntry(extensionEntry)
    PluginRepository1->>Plugin1:<<dynamic import>>
    Plugin1-->>PluginManager:ExtensionDescriptor
    PluginManager->>Extension1Factory:create()
    activate Extension1Factory
    Extension1Factory->>Extension1:<<new>>
    Extension1Factory-->>PluginManager:Extension1
    deactivate Extension1Factory
    PluginManager-->>HostApplication:Extension1
    deactivate PluginManager
    HostApplication->>Extension1:extensionPoint1Method
    activate Extension1
    deactivate Extension1
```

As `ExtensionPoints` are simply Typescript classes, for the purposes of testing
or validation, it is possible to bypass the framework altogether and import an
`Extension` and use it directly:

```mermaid
%%{init: { "sequence": { "mirrorActors":false }}}%%
sequenceDiagram
    HostApplication->>Extension1:<<static import>>
    HostApplication->>Extension1:extensionPoint1Method
    activate Extension1
    deactivate Extension1
```

## Examples

The following example projects are available which support execution in both a
terminal and a browser:

- [Host Application](https://github.com/flowscripter/example-host-application)
- [Plugin](https://github.com/flowscripter/example-plugin)

## API

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

The following diagram provides an overview of the `PluginManager` API:

```mermaid
classDiagram
    class PluginManager {
        <<interface>>
        registerExtensions(extensionPoint)
        getRegisteredExtensions(extensionPoint) Set<ExtensionInfo>
        instantiate(extensionHandle, hostData: Map<string, string>) Extension
    }

    class ExtensionInfo {
        <<interface>>
        extensionHandle
        extensionData: Map<string, string>
        pluginData: Map<string, string>
    }
```

API docs for the library:

[API Documentation](https://doc.deno.land/https://deno.land/x/flowscripter_dynamic_plugin_framework/mod.ts)

## Development

Test: `deno test -A --unstable`

Lint: `deno fmt`

The following diagram provides an overview of the main internal classes:

```mermaid
classDiagram
    class PluginManager {
        <<interface>>
    }

    class DefaultPluginManager {
    }

    class ExtensionPointRegistry {
        <<interface>>
    }

    class ExtensionRegistry {
        <<interface>>
    }

    class PluginRepository {
        <<interface>>
    }

    class UrlListPluginRepository {
    }

    class InMemoryExtensionRegistry {
    }

    class InMemoryExtensionPointRegistry {
    }

    PluginManager <|.. DefaultPluginManager
    ExtensionPointRegistry <|.. InMemoryExtensionPointRegistry
    ExtensionRegistry <|.. InMemoryExtensionRegistry
    DefaultPluginManager --> ExtensionPointRegistry
    DefaultPluginManager --> ExtensionRegistry
    DefaultPluginManager --> "1..*" PluginRepository
    PluginRepository <|.. UrlListPluginRepository
```

## License

MIT © Flowscripter
