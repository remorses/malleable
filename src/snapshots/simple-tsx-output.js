import React from 'react';
import { jsx } from 'react/jsx-runtime';

const App = () => jsx('div', { className: "p-4 bg-blue-500 text-white"  , children: "Hello"});

const OriginalDefault = App;
function WrappedComponent(props) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('link', { rel: 'stylesheet', href: "https://remote-bundler.fumabase.com/bundle/test-mesigh/index.css" }),
    OriginalDefault ? React.createElement(OriginalDefault, props) : null,
  );
}

export { WrappedComponent as default };
