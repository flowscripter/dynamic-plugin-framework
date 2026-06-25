# Key Concepts

The framework's key concepts are borrowed from the Eclipse Project's extension
framework. The key concepts are:

- A `Plugin` provides one or more `Extension` implementations.
- Each `Extension` implementation declares an `ExtensionPoint` identifier and an
  `ExtensionFactory` via an `ExtensionDescriptor`.
- A `HostApplication` instantiates a `PluginManager`.
- The `HostApplication` can register one or more `ExtensionPoint` identifiers
  that the `PluginManager` should be aware of.
- The `PluginManager` scans one or more `PluginRepository` implementations to
  find and register `Plugin` objects for any `ExtensionPoint` identifiers it is
  aware of.
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

As `ExtensionPoints` are simply Typescript objects, for the purposes of testing
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
