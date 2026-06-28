# Development

Install dependencies:

`bun install`

Build (produces `dist/` for Node.js and TypeScript consumers; Bun uses raw source directly):

`bun run build`

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
