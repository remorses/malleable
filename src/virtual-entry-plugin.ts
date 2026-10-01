import type { Plugin } from 'esbuild-wasm'
import dedent from 'string-dedent'

interface VirtualEntryOptions {
  actualEntryPath: string
  /** Absolute CSS URL. When omitted, the CSS is resolved next to the entry module. */
  cssUrl?: string
  baseUrl?: string
}

const js = dedent

export function createVirtualEntryPlugin(options: VirtualEntryOptions): Plugin {
  const { actualEntryPath, cssUrl, baseUrl } = options
  const cssHref = cssUrl
    ? JSON.stringify(cssUrl)
    : `new URL('./index.css', import.meta.url).href`
  const virtualModuleId = 'virtual:entry'

  return {
    name: 'virtual-entry',
    setup(build) {
      // Resolve the virtual entry module
      build.onResolve({ filter: /^virtual:entry$/ }, (args) => {
        return {
          path: virtualModuleId,
          namespace: 'virtual-entry',
        }
      })

      // Load the virtual entry module content
      build.onLoad({ filter: /.*/, namespace: 'virtual-entry' }, (args) => {
        const content = js`
          import React from 'react';
          import * as ActualEntry from './${actualEntryPath}';

          // Re-export all named exports
          export * from './${actualEntryPath}';

          // Original default export
          const OriginalDefault = ActualEntry.default;

          // Default export with CSS link
          const WrappedComponent = (props) => {
            return (
              <>
                <link rel="stylesheet" href={${cssHref}} />
                {OriginalDefault ? <OriginalDefault {...props} /> : null}
              </>
            );
          };

          export default WrappedComponent;
        `

        return {
          contents: content,
          loader: 'jsx',
        }
      })
    },
  }
}
