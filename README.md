# deno-dynamic-plugin-framework

[![version](https://img.shields.io/github/v/release/flowscripter/deno-dynamic-plugin-framework?sort=semver)](https://github.com/flowscripter/deno-dynamic-plugin-framework/releases)
[![build](https://img.shields.io/github/workflow/status/flowscripter/deno-dynamic-plugin-framework/release-deno-library)](https://github.com/flowscripter/deno-dynamic-plugin-framework/actions/workflows/release-deno-library.yml)
[![coverage](https://codecov.io/gh/flowscripter/deno-dynamic-plugin-framework/branch/main/graph/badge.svg?token=EMFT2938ZF)](https://codecov.io/gh/flowscripter/deno-dynamic-plugin-framework)
[![dependencies](https://img.shields.io/endpoint?url=https%3A%2F%2Fdeno-visualizer.danopia.net%2Fshields%2Fupdates%2Fhttps%2Fraw.githubusercontent.com%2Fflowscripter%2Fdeno-dynamic-plugin-framework%2Fmain%2Fmod.ts)](https://github.com/flowscripter/deno-dynamic-plugin-framework/blob/main/deps.ts)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https://deno.land/x/flowscripter_deno_dynamic_plugin_framework/mod.ts)
[![license: MIT](https://img.shields.io/github/license/flowscripter/deno-dynamic-plugin-framework)](https://github.com/flowscripter/deno-dynamic-plugin-framework/blob/main/LICENSE)

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

![High Level Class Diagram](https://raw.githubusercontent.com/flowscripter/deno-dynamic-plugin-framework/main/images/high_level_class_diagram.png "High Level Class Diagram")

The following sequence diagram illustrates the key steps for a `HostApplication`
to use a `PluginManager` for discovery and registration of `Plugin` instances:

![Registration Sequence Diagram](https://raw.githubusercontent.com/flowscripter/deno-dynamic-plugin-framework/main/images/registration_sequence_diagram.png "Registration Sequence Diagram")

Once registration has been performed, the `HostApplication` may query the
`PluginManager` for `Extensions` of known `ExtensionPoints` and then instantiate
them:

![Query and Instantiation Sequence Diagram](https://raw.githubusercontent.com/flowscripter/deno-dynamic-plugin-framework/main/images/query_and_instantiation_sequence_diagram.png "Query and Instantiation Sequence Diagram")

As `ExtensionPoints` are simply Typescript classes, for the purposes of testing
or validation, it is possible to bypass the framework altogether and import an
`Extension` and use it directly:

![Direct Instantiation Sequence Diagram](https://raw.githubusercontent.com/flowscripter/deno-dynamic-plugin-framework/main/images/direct_instantiation_sequence_diagram.png "Direct Instantiation Sequence Diagram")

## Examples

The following example projects are available which support execution in both a
terminal and a browser:

- [Host Application](https://github.com/flowscripter/example-host-application)
- [Plugin](https://github.com/flowscripter/example-plugin)

## API

The following diagram provides an overview of the `Plugin` API:

![Plugin API Class Diagram](https://raw.githubusercontent.com/flowscripter/deno-dynamic-plugin-framework/main/images/plugin_api_class_diagram.png "Plugin API Class Diagram")

The following diagram provides an overview of the `PluginManager` API:

![Plugin Manager API Class Diagram](https://raw.githubusercontent.com/flowscripter/deno-dynamic-plugin-framework/main/images/plugin_manager_api_class_diagram.png "Plugin Manager API Class Diagram")

API docs for the library:

[API Documentation](https://doc.deno.land/https://deno.land/x/flowscripter_deno_dynamic_plugin_framework/mod.ts)

## Development

Test: `deno test -A --unstable`

Lint: `deno fmt`

The following diagram provides an overview of the main internal classes:

![Implementation Class Diagram](https://raw.githubusercontent.com/flowscripter/deno-dynamic-plugin-framework/main/images/implementation_class_diagram.png "Implementation Class Diagram")

## License

MIT © Flowscripter
