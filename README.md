# dynamic-plugin-framework

[![version](https://img.shields.io/github/v/release/flowscripter/dynamic-plugin-framework?sort=semver)](https://github.com/flowscripter/dynamic-plugin-framework/releases)
[![build](https://img.shields.io/github/actions/workflow/status/flowscripter/dynamic-plugin-framework/release-bun-library.yml)](https://github.com/flowscripter/dynamic-plugin-framework/actions/workflows/release-bun-library.yml)
[![coverage](https://codecov.io/gh/flowscripter/dynamic-plugin-framework/branch/main/graph/badge.svg?token=EMFT2938ZF)](https://codecov.io/gh/flowscripter/dynamic-plugin-framework)
[![docs](https://img.shields.io/badge/docs-API-blue)](https://flowscripter.github.io/dynamic-plugin-framework/index.html)
[![license: MIT](https://img.shields.io/github/license/flowscripter/dynamic-plugin-framework)](https://github.com/flowscripter/dynamic-plugin-framework/blob/main/LICENSE)

> Dynamic plugin framework for Bun based on Javascript Modules and import()
> function

## Overview

This project provides a framework for defining plugins which can be dynamically
discovered and imported into a running process.

#### Key Features

- Plugins published as bundled JS files or npm packages.
- Plugin versioning with scope, name, semver version and dependency declarations
- Searchable marketplace repositories backed by npmjs.com (or compatible registries) or a static HTTP manifest
- Local plugin repositories backed by a `node_modules` folder or a local install folder
- Plugin installer with dependency resolution, update checking and dependent-safety guards on uninstall
- Universal support for both Bun and browser runtimes
- Dynamic plugin import using
  [Javascript dynamic import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)
- ES2015 module based
- Written in Typescript

## Usage Examples

The following example projects are available which support execution in both a
terminal and a browser:

- [Plugin](https://github.com/flowscripter/example-plugin)
- [Host Application](https://github.com/flowscripter/example-host-application)
- [Host Webapp](https://github.com/flowscripter/example-host-webapp)

## Further Details

- [Key Concepts](./README/key-concepts.md)
- [Implementation Details](./README/implementation-details.md)
- [Development](./README/development.md)
- [API Documentation](https://flowscripter.github.io/dynamic-plugin-framework/index.html)

## License

MIT © Flowscripter
