import React from 'react';
import { jsx } from 'react/jsx-runtime';

const App = () => jsx('div', { className: "p-4 bg-blue-500 text-white"  , children: "Hello"});

const OriginalDefault = App;
function WrappedComponent(props) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('link', { rel: 'stylesheet', href: new URL('./index.css', import.meta.url).href }),
    OriginalDefault ? React.createElement(OriginalDefault, props) : null,
  );
}

export { WrappedComponent as default };
