# Implementation Details

The package provides two entry points depending on your role:

**Plugin authors** only need the three plugin-side interfaces. Import from the
`/plugin` subpath to keep the host implementation out of your module graph:

```typescript
import type {
  Plugin,
  ExtensionDescriptor,
  ExtensionFactory,
} from "@flowscripter/dynamic-plugin-framework/plugin";
```

**Host application authors** import from the main entry point, which exposes
the full API including concrete implementations:

```typescript
import {
  DefaultPluginManager,
  UrlListPluginRepository,
} from "@flowscripter/dynamic-plugin-framework";
import type { ExtensionInfo, PluginManager } from "@flowscripter/dynamic-plugin-framework";
```

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
