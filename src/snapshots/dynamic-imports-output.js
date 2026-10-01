import React, { lazy, useState, useEffect, Suspense } from 'react';
import { jsxs, jsx } from 'react/jsx-runtime';

// React.lazy for component code splitting
              const LazyComponent = lazy(() => import('./chunks/LazyComponent-Dh0jNps_.js'));

              const App = () => {
                const [dynamicModule, setDynamicModule] = useState(null);
                const [showLazy, setShowLazy] = useState(false);

                useEffect(() => {
                  // Dynamic import for code splitting
                  import('./chunks/DynamicModule-OnSjh2dR.js').then(module => {
                    setDynamicModule(module);
                    console.log('Dynamic module loaded:', module);
                  });
                }, []);

                return (
                  jsxs('div', { className: "p-8 bg-gray-100 min-h-screen"  , children: [
                    jsx('h1', { className: "text-3xl font-bold mb-6"  , children: "Code Splitting Demo"  })

                    , jsxs('div', { className: "space-y-4", children: [
                      jsxs('button', {
                        onClick: () => setShowLazy(!showLazy),
                        className: "px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"     ,
 children: [
                        showLazy ? 'Hide' : 'Show', " Lazy Component"
                      ]})

                      , showLazy && (
                        jsx(Suspense, { fallback: jsx('div', { className: "p-4 bg-gray-200" , children: "Loading..."}), children: 
                          jsx(LazyComponent, {} )
                        })
                      )

                      , dynamicModule && (
                        jsx('div', { className: "p-4 bg-green-100 rounded"  , children: 
                          jsx('p', { children: "Dynamic module loaded successfully!"   })
                        })
                      )
                    ]})
                  ]})
                );
              };

              // Also test a dynamic import function
              async function loadDynamicData() {
                const module = await import('./chunks/DynamicModule-OnSjh2dR.js');
                return module.dynamicData;
              }

const OriginalDefault = App;
function WrappedComponent(props) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('link', { rel: 'stylesheet', href: "https://remote-bundler.fumabase.com/bundle/test-53zzv8/index.css" }),
    OriginalDefault ? React.createElement(OriginalDefault, props) : null,
  );
}

export { App, WrappedComponent as default, loadDynamicData };
