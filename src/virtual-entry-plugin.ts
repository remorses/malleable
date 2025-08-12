import { createUnplugin } from 'unplugin'
import dedent from 'string-dedent'

interface VirtualEntryOptions {
  actualEntryPath: string
  cssUrl: string
  baseUrl: string
}

export const createVirtualEntryPlugin = createUnplugin<VirtualEntryOptions>((options) => {
  const { actualEntryPath, cssUrl, baseUrl } = options
  const virtualModuleId = 'virtual:entry'
  const resolvedVirtualModuleId = '\0' + virtualModuleId
  
  return {
    name: 'virtual-entry',
    
    // Configure esbuild-specific loader
    esbuild: {
      loader: (code, id) => {
        // Use JSX loader for our virtual entry
        if (id === resolvedVirtualModuleId) {
          return 'jsx'
        }
        // Return tsx as default for other files
        return 'tsx'
      }
    },
    
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
      return null
    },
    
    load(id) {
      if (id === resolvedVirtualModuleId) {
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
          code: content,
          
          map: null
        }
      }
      return null
    }
  }
})