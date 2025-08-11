import type { Plugin } from 'esbuild-wasm'
import dedent from 'string-dedent'

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

      // Load the virtual entry module with shadow root support by default
      build.onLoad({ filter: /.*/, namespace: 'virtual-entry' }, () => {
        const content = dedent`
          import React, { useLayoutEffect, useRef, useState } from 'react';
          import { createPortal } from 'react-dom';
          import * as ActualEntry from './${actualEntryPath}';

          // Re-export all named exports
          export * from './${actualEntryPath}';

          // ScopedIsland component for shadow root isolation
          function ScopedIsland({ href, children, className }) {
            const hostRef = useRef(null);
            const [shadow, setShadow] = useState(null);
            const [ready, setReady] = useState(false);

            useLayoutEffect(() => {
              if (!hostRef.current || shadow) return;
              setShadow(hostRef.current.attachShadow({ mode: 'open' }));
            }, [shadow]);

            return (
              <div ref={hostRef} className={className} style={{ visibility: ready ? 'visible' : 'hidden' }}>
                {shadow &&
                  createPortal(
                    <>
                      <link
                        rel="stylesheet"
                        href={href}
                        onLoad={() => setReady(true)}
                        onError={() => setReady(true)} // fail open so UI still appears
                      />
                      {ready ? children : null}
                    </>,
                    shadow
                  )}
              </div>
            );
          }

          // Original default export
          const OriginalDefault = ActualEntry.default;

          // Default export with shadow root isolation
          const WrappedComponent = (props) => {
            return (
              <ScopedIsland href="${cssUrl}" className={props.className}>
                {OriginalDefault ? <OriginalDefault {...props} /> : null}
              </ScopedIsland>
            );
          };

          export default WrappedComponent;

          // Export version without shadow root
          export const WithoutShadowRoot = (props) => {
            return (
              <>
                <link rel="stylesheet" href="${cssUrl}" />
                {OriginalDefault ? <OriginalDefault {...props} /> : null}
              </>
            );
          };
        `

        return {
          contents: content,
          loader: 'tsx',
        }
      })
    },
  }
}