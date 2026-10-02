import React, { lazy, useState, Suspense } from 'react';
import { jsxs, jsx } from 'react/jsx-runtime';

const LazyComponent = lazy(() => import('./chunks/LazyComponent-DIGiiDRE.js'));
        async function loadDynamicData() {
          const module = await import('./chunks/DynamicModule-DQFd5tIm.js');
          return module.dynamicData;
        }
        function App() {
          const [show, setShow] = useState(false);
          return (
            jsxs('div', { className: "p-8 bg-gray-100" , children: [
              jsx('button', { onClick: () => setShow(!show), className: "px-6 py-3 bg-blue-500 hover:bg-blue-600"   , children: "Toggle"})
              , show && jsx(Suspense, { fallback: jsx('div', { className: "p-4 bg-gray-200" , children: "Loading..."}), children: jsx(LazyComponent, {} )})
            ]})
          );
        }

const OriginalDefault = App;
function WrappedComponent(props) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('link', { rel: 'stylesheet', href: new URL('./index.css', import.meta.url).href }),
    OriginalDefault ? React.createElement(OriginalDefault, props) : null,
  );
}

export { WrappedComponent as default, loadDynamicData };
