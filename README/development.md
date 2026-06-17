# Development

Install dependencies:

`bun install`

Test:

`bun test`

Format:

`bunx oxfmt`

Lint:

`bunx oxlint index.ts plugin.ts src/ tests/`

Generate HTML API Documentation:

`bunx typedoc index.ts`

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
