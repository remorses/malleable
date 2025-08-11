import type { Plugin } from 'esbuild-wasm'

export function createVirtualEntryPlugin({
  actualEntryPath,
  cssUrl,
  baseUrl
}: {
  actualEntryPath: string
  cssUrl: string
  baseUrl: string
}): Plugin {
  return {
    name: 'virtual-entry',
    setup(build) {
      // Resolve virtual:entry to our virtual module
      build.onResolve({ filter: /^virtual:entry$/ }, () => ({
        path: 'virtual:entry',
        namespace: 'virtual-entry',
      }))

      // Load the virtual entry module
      build.onLoad({ filter: /.*/, namespace: 'virtual-entry' }, () => {
        // Create a virtual module that:
        // 1. Imports React
        // 2. Wraps the default export with a Fragment containing the link tag
        // 3. Re-exports other exports from the actual entry
        const content = `
import React from 'react';
import * as ActualEntry from './${actualEntryPath}';

// Re-export all named exports
export * from './${actualEntryPath}';

// Wrap the default export to include CSS link
const OriginalDefault = ActualEntry.default;

const WrappedComponent = (props) => {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('link', {
      rel: 'stylesheet',
      href: '${cssUrl}'
    }),
    OriginalDefault ? React.createElement(OriginalDefault, props) : null
  );
};

export default WrappedComponent;
`

        return {
          contents: content,
          loader: 'tsx',
        }
      })
    },
  }
}
